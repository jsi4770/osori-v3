package com.suin.fincoach.nlparse.model.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.suin.fincoach.coaching.model.service.GeminiClient;
import com.suin.fincoach.nlparse.model.dao.MerchantCacheDao;
import com.suin.fincoach.nlparse.model.dao.NlInputHistoryDao;
import com.suin.fincoach.nlparse.model.vo.MerchantCategoryCache;
import com.suin.fincoach.nlparse.model.vo.NlInputHistory;
import com.suin.fincoach.nlparse.util.RegexExpenseParser;

import lombok.extern.slf4j.Slf4j;

// 자연어 지출 입력 파싱. 원칙: LLM은 추출만 담당하고, 필수값 검증/카테고리 enum 강제/
// 금액 이중 체크/저장 여부 판단은 전부 이 서비스(서버 코드)가 한다 — LLM 출력을 그대로 신뢰하지 않는다.
@Service
@Slf4j
public class NlExpenseParseServiceImpl implements NlExpenseParseService {

	@Autowired
	private GeminiClient geminiClient;

	@Autowired
	private MerchantCacheDao merchantCacheDao;

	@Autowired
	private NlInputHistoryDao nlInputHistoryDao;

	@Autowired
	private SqlSessionTemplate sqlSession;

	@Value("${coaching.llm.enabled:false}")
	private boolean llmEnabled;

	// 이 값 미만이면 원탭 확인 UI를 거치고, 이상이면 확인 없이 바로 저장한다.
	private static final double CONFIDENCE_THRESHOLD = 0.7;

	// 예시 칩 개수(개인화 이력이 있을 때). 정적 기본 예시 개수와 맞춤.
	private static final int EXAMPLE_LIMIT = 3;

	// 서버 기본 타임존이 흔들려도(Railway 등) "오늘"은 항상 한국 기준이어야 한다 —
	// FincoachApplication에서 JVM 기본 타임존을 이미 Asia/Seoul로 고정했지만, 여기서도
	// 명시적으로 지정해 이 클래스만 봐도 의도가 분명하도록 한다.
	private static final ZoneId KST = ZoneId.of("Asia/Seoul");

	// app/src/constants/categories.js의 EXPENSE_CATEGORIES/INCOME_CATEGORIES와 동일하게 유지해야 함.
	private static final List<String> EXPENSE_CATEGORIES = List.of(
			"식비", "생활/마트", "쇼핑", "의료/건강", "교통", "문화/여가", "교육",
			"주거/월세", "통신비", "보험", "구독서비스", "기타");

	private static final List<String> INCOME_CATEGORIES = List.of(
			"월급", "용돈", "금융소득", "상여금", "기타");

	@Override
	public Map<String, Object> parse(int userId, String text, String type) {
		String txType = normalizeType(type);
		List<String> categories = categoriesFor(txType);
		LocalDate today = LocalDate.now(KST);
		Integer regexAmount = RegexExpenseParser.parseAmount(text);

		JSONObject llm = null;
		String source = "regex-fallback";
		if (llmEnabled) {
			llm = geminiClient.generateStructured(
					buildSystemPrompt(today, txType, categories), buildContents(text), responseSchema(categories));
			if (llm != null) {
				source = "llm";
			}
		}

		Integer amount;
		String category;
		String subcategory;
		String merchant;
		String memo;
		double confidence;
		LocalDate date;

		if (llm != null) {
			Integer llmAmount = toInteger(llm.get("amount"));
			// 금액은 LLM 결과와 정규식 결과가 다르면 정규식 쪽을 신뢰한다(자릿수 오류 방지 목적의 이중 체크).
			amount = (regexAmount != null && !regexAmount.equals(llmAmount)) ? regexAmount : llmAmount;

			category = normalizeCategory(str(llm.get("category")), categories);
			subcategory = blankToNull(str(llm.get("subcategory")));
			merchant = blankToNull(str(llm.get("merchant")));
			String llmMemo = str(llm.get("memo"));
			memo = (llmMemo == null || llmMemo.isBlank()) ? text : llmMemo;
			confidence = toDouble(llm.get("confidence"), 0.5);
			date = resolveLlmDate(str(llm.get("date")), today);
		} else {
			amount = regexAmount;
			category = "기타";
			subcategory = null;
			merchant = null;
			memo = text;
			confidence = 0.3; // LLM 없이 뽑은 값은 항상 확인 UI를 거치도록 낮게 고정
			date = RegexExpenseParser.parseDate(text, today);
		}

		if (amount == null || amount <= 0) {
			return Map.of(
					"ok", false,
					"errorReason", "AMOUNT_NOT_FOUND",
					"message", "금액을 찾지 못했어요. 다시 입력해주세요.");
		}

		// 이 유저가 같은 가맹점/수입원을 저장·확인해 학습된 카테고리가 있으면 LLM 추측보다 우선한다.
		if (merchant != null) {
			MerchantCategoryCache cached =
					merchantCacheDao.selectByUserAndMerchant(sqlSession, userId, normalizeMerchant(txType, merchant));
			if (cached != null) {
				category = cached.getCategory();
				confidence = Math.max(confidence, 0.95);
				source = source + "+cache";
			}
		}

		Map<String, Object> result = new HashMap<>();
		result.put("ok", true);
		result.put("amount", amount);
		result.put("category", category);
		result.put("subcategory", subcategory);
		result.put("merchant", merchant);
		result.put("date", date.toString());
		result.put("memo", memo);
		result.put("confidence", confidence);
		result.put("needsConfirmation", confidence < CONFIDENCE_THRESHOLD);
		result.put("source", source);
		return result;
	}

	@Override
	public void learn(int userId, String merchant, String category, String type, String rawText) {
		String txType = normalizeType(type);

		if (merchant != null && !merchant.isBlank() && category != null && !category.isBlank()) {
			MerchantCategoryCache cache = MerchantCategoryCache.builder()
					.userId(userId)
					.merchant(normalizeMerchant(txType, merchant))
					.category(category)
					.build();
			merchantCacheDao.upsert(sqlSession, cache);
		}

		// 원문 문장도 함께 기록해 예시 칩을 개인화한다. merchant 유무와 무관하게 독립적으로 동작.
		if (rawText != null && !rawText.isBlank()) {
			String trimmed = rawText.trim();
			NlInputHistory history = NlInputHistory.builder()
					.userId(userId)
					.type(txType)
					.inputText(trimmed.length() > 200 ? trimmed.substring(0, 200) : trimmed)
					.build();
			nlInputHistoryDao.upsert(sqlSession, history);
		}
	}

	@Override
	public List<String> getExamples(int userId, String type) {
		List<String> texts = nlInputHistoryDao.selectTopTexts(sqlSession, userId, normalizeType(type), EXAMPLE_LIMIT);
		return texts == null ? Collections.emptyList() : texts;
	}

	private String normalizeType(String type) {
		return "IN".equalsIgnoreCase(type) ? "IN" : "OUT";
	}

	private List<String> categoriesFor(String txType) {
		return "IN".equals(txType) ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
	}

	private String buildSystemPrompt(LocalDate today, String txType, List<String> categories) {
		boolean isIncome = "IN".equals(txType);
		String subject = isIncome ? "수입" : "지출";
		String categoriesStr = String.join(", ", categories);
		return "당신은 사용자가 프롬프트처럼 자유롭게 입력한 " + subject + " 내역을 구조화된 데이터로 추출하는 도우미입니다. "
				+ "오늘 날짜는 " + today + "입니다. '어제', '그제', '3일 전'처럼 상대적인 날짜 표현은 반드시 이 날짜를 "
				+ "기준으로 계산해 yyyy-MM-dd 형식으로 답하세요(모델 자체 학습 시점 기준으로 착각하지 마세요). "
				+ "category는 반드시 다음 목록 중 하나여야 합니다: " + categoriesStr + ". 목록에 없는 카테고리를 새로 "
				+ "만들지 마세요. amount는 텍스트에서 명확하게 찾을 수 있는 원 단위 " + subject + " 금액만 넣고, 찾을 수 없으면 "
				+ "추측하지 말고 0으로 답하세요. merchant는 " + (isIncome ? "입금처나 수입원 이름이" : "가게/거래처 이름이")
				+ " 텍스트에 있을 때만 채우고 없으면 빈 문자열로 답하세요. confidence는 category 판단의 확신 정도를 0~1 사이 "
				+ "숫자로 답하되, " + (isIncome
						? "수입 출처가 불분명하면"
						: "'쿠팡에서 3만원'처럼 무엇을 샀는지 알 수 없어 카테고리를 특정하기 어려우면")
				+ " 낮게(0.5 이하로) 답하세요.";
	}

	private JSONArray buildContents(String text) {
		JSONArray contents = new JSONArray();
		contents.add(geminiClient.userTurn(text));
		return contents;
	}

	private JSONObject responseSchema(List<String> categories) {
		JSONObject amount = new JSONObject();
		amount.put("type", "INTEGER");

		JSONObject category = new JSONObject();
		category.put("type", "STRING");
		JSONArray categoryEnum = new JSONArray();
		categoryEnum.addAll(categories);
		category.put("enum", categoryEnum);

		JSONObject subcategory = new JSONObject();
		subcategory.put("type", "STRING");

		JSONObject merchant = new JSONObject();
		merchant.put("type", "STRING");

		JSONObject date = new JSONObject();
		date.put("type", "STRING");

		JSONObject memo = new JSONObject();
		memo.put("type", "STRING");

		JSONObject confidence = new JSONObject();
		confidence.put("type", "NUMBER");

		JSONObject properties = new JSONObject();
		properties.put("amount", amount);
		properties.put("category", category);
		properties.put("subcategory", subcategory);
		properties.put("merchant", merchant);
		properties.put("date", date);
		properties.put("memo", memo);
		properties.put("confidence", confidence);

		JSONObject schema = new JSONObject();
		schema.put("type", "OBJECT");
		schema.put("properties", properties);
		JSONArray required = new JSONArray();
		required.add("amount");
		required.add("category");
		required.add("confidence");
		schema.put("required", required);
		return schema;
	}

	private String normalizeCategory(String category, List<String> categories) {
		if (category != null && categories.contains(category)) {
			return category;
		}
		return "기타";
	}

	// 캐시 키에 type을 접두어로 섞어 넣어(예: "in::회사") 스키마 변경 없이 수입/지출 가맹점 캐시를 분리한다
	// — "회사"가 수입원과 지출처 양쪽으로 쓰이는 경우처럼 이름이 겹쳐도 서로 다른 카테고리로 안전하게 학습된다.
	private String normalizeMerchant(String txType, String merchant) {
		return txType + "::" + merchant.trim().toLowerCase();
	}

	private LocalDate resolveLlmDate(String rawDate, LocalDate today) {
		if (rawDate != null) {
			try {
				LocalDate parsed = LocalDate.parse(rawDate.trim());
				return parsed.isAfter(today) ? today : parsed;
			} catch (Exception e) {
				log.warn("LLM이 반환한 날짜 파싱 실패, 정규식 폴백으로 대체: {}", rawDate);
			}
		}
		return RegexExpenseParser.parseDate(rawDate, today);
	}

	private String str(Object value) {
		return value == null ? null : String.valueOf(value);
	}

	private String blankToNull(String value) {
		return (value == null || value.isBlank()) ? null : value.trim();
	}

	private Integer toInteger(Object value) {
		if (value instanceof Number) {
			return ((Number) value).intValue();
		}
		try {
			return Integer.parseInt(String.valueOf(value).trim());
		} catch (Exception e) {
			return null;
		}
	}

	private double toDouble(Object value, double defaultValue) {
		if (value instanceof Number) {
			return ((Number) value).doubleValue();
		}
		try {
			return Double.parseDouble(String.valueOf(value).trim());
		} catch (Exception e) {
			return defaultValue;
		}
	}

}
