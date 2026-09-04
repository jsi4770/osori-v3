package com.suin.fincoach.nlparse.model.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.suin.fincoach.category.model.service.CategoryService;
import com.suin.fincoach.coaching.model.service.GeminiClient;
import com.suin.fincoach.fx.model.vo.Currency;
import com.suin.fincoach.fx.model.vo.FxRateResult;
import com.suin.fincoach.fx.service.FxRateService;
import com.suin.fincoach.nlparse.model.dao.MerchantCacheDao;
import com.suin.fincoach.nlparse.model.dao.NlInputHistoryDao;
import com.suin.fincoach.nlparse.model.dao.NlParseLogDao;
import com.suin.fincoach.nlparse.model.vo.MerchantCategoryCache;
import com.suin.fincoach.nlparse.model.vo.NlInputHistory;
import com.suin.fincoach.nlparse.model.vo.NlParseLog;
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
	private NlParseLogDao nlParseLogDao;

	@Autowired
	private CategoryService categoryService;

	@Autowired
	private FxRateService fxRateService;

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

	// 카테고리 힌트로 프롬프트에 넣을 "자주 쓰는 카테고리" 최대 개수.
	private static final int TOP_CATEGORY_HINT_LIMIT = 5;

	@Override
	public Map<String, Object> parse(int userId, String text, String type) {
		String txType = normalizeType(type);
		List<String> categories = categoriesFor(userId, txType);
		List<String> topUsedCategories = categoryService.getTopUsedCategories(userId, txType, TOP_CATEGORY_HINT_LIMIT);
		LocalDate today = LocalDate.now(KST);
		Integer regexAmount = RegexExpenseParser.parseAmount(text);

		JSONObject llm = null;
		String source = "regex-fallback";
		if (llmEnabled) {
			llm = geminiClient.generateStructured(
					buildSystemPrompt(today, txType, categories, topUsedCategories),
					buildContents(text),
					responseSchema(categories));
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
		Integer installmentMonths;

		Integer regexInstallmentMonths = RegexExpenseParser.parseInstallmentMonths(text);

		if (llm != null) {
			Integer llmAmount = toInteger(llm.get("amount"));
			// 금액은 LLM 결과와 정규식 결과가 다르면 정규식 쪽을 신뢰한다(자릿수 오류 방지 목적의 이중 체크).
			amount = (regexAmount != null && !regexAmount.equals(llmAmount)) ? regexAmount : llmAmount;

			category = normalizeCategory(str(llm.get("category")), categories);
			subcategory = blankToNull(str(llm.get("subcategory")));
			merchant = blankToNull(str(llm.get("merchant")));
			String llmMemo = str(llm.get("memo"));
			// LLM이 memo를 안 주면 원문 전체 대신 금액·날짜만 제거한 나머지를 쓴다.
			memo = (llmMemo == null || llmMemo.isBlank()) ? RegexExpenseParser.stripAmountAndDate(text) : llmMemo;
			confidence = toDouble(llm.get("confidence"), 0.5);
			date = resolveLlmDate(str(llm.get("date")), today);

			Integer llmInstallmentMonths = toInteger(llm.get("installmentMonths"));
			// 할부 개월수도 금액과 동일하게: 정규식과 LLM 결과가 다르면 정규식 쪽을 신뢰한다.
			installmentMonths =
					(regexInstallmentMonths != null && !regexInstallmentMonths.equals(llmInstallmentMonths))
							? regexInstallmentMonths
							: llmInstallmentMonths;
		} else {
			amount = regexAmount != null ? regexAmount : RegexExpenseParser.parseForeignAmount(text);
			category = "기타";
			subcategory = null;
			merchant = null;
			memo = RegexExpenseParser.stripAmountAndDate(text);
			confidence = 0.3; // LLM 없이 뽑은 값은 항상 확인 UI를 거치도록 낮게 고정
			date = RegexExpenseParser.parseDate(text, today);
			installmentMonths = regexInstallmentMonths;
		}

		// 할부는 지출에만 있는 개념이고, 1개월은 할부가 아니라 일시불과 같다 — 둘 다 "할부 아님"으로 정규화.
		if (!"OUT".equals(txType) || installmentMonths == null || installmentMonths < 2) {
			installmentMonths = null;
		}

		if (amount == null || amount <= 0) {
			return Map.of(
					"ok", false,
					"errorReason", "AMOUNT_NOT_FOUND",
					"message", "금액을 찾지 못했어요. 다시 입력해주세요.");
		}

		// --- 외화 처리 ---
		// 사용자가 "원" 대신 다른 통화 단위로 말했으면(예: "런던에서 30파운드 점심"), 거래일 기준 환율로
		// 원화 환산해 저장값(amount = 원화)을 만들고, 원본 외화 금액/환율은 스냅샷으로 결과에 싣는다.
		// LLM이 통화를 뽑았으면 그걸 우선하고, 없으면 정규식으로 단위를 감지한다.
		String currencyCode = (llm != null) ? blankToNull(str(llm.get("currency"))) : null;
		if (currencyCode == null) {
			currencyCode = RegexExpenseParser.parseCurrency(text);
		}
		Currency currency = Currency.of(currencyCode);
		Integer fxAmount = null;
		FxRateResult fx = null;
		if (currency != Currency.KRW) {
			// 외화면 정규식-LLM 자릿수 이중 체크를 신뢰하지 않는다(정규식은 원화 가정이라 '3만엔'을
			// 30000'원'으로 오인할 수 있음). LLM 원값이 있으면 그걸, 없으면 지금 amount를 외화 금액으로 본다.
			if (llm != null) {
				Integer llmAmount = toInteger(llm.get("amount"));
				if (llmAmount != null && llmAmount > 0) {
					amount = llmAmount;
				}
			}
			fxAmount = amount;
			fx = fxRateService.getRate(currency.name(), date);
			amount = fx.toKrw(BigDecimal.valueOf(fxAmount));
			if (amount <= 0) {
				return Map.of(
						"ok", false,
						"errorReason", "AMOUNT_NOT_FOUND",
						"message", "환율 환산에 실패했어요. 잠시 후 다시 시도해주세요.");
			}
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
		// 할부가 인식되거나(회차별 분할 등록이라 되돌리기 번거로움) 외화 거래면(적용 환율을 사용자가
		// 눈으로 확인해야 함) 확신도와 무관하게 항상 확인 UI를 거치게 한다.
		result.put("needsConfirmation",
				confidence < CONFIDENCE_THRESHOLD || installmentMonths != null || currency != Currency.KRW);
		result.put("source", source);
		result.put("installmentMonths", installmentMonths);

		if (currency != Currency.KRW && fx != null) {
			result.put("currency", currency.name());
			result.put("fxAmount", fxAmount);
			result.put("fxRate", fx.getRate());
			result.put("fxRateDate", fx.getRateDate() == null ? null : fx.getRateDate().toString());
			result.put("fxRateSource", fx.getSource());
			result.put("fxStale", fx.isStale());
		} else {
			result.put("currency", "KRW");
		}

		logParse(userId, txType, text, source, llm, result, confidence);

		return result;
	}

	// 향후 소형 모델 파인튜닝용 데이터 확보를 위한 (입력 -> 파싱 결과) 로깅. 로깅 실패가 실제
	// 파싱 응답에 영향을 주면 안 되므로 예외를 삼키고 경고만 남긴다.
	private void logParse(int userId, String txType, String text, String source, JSONObject llm,
			Map<String, Object> result, double confidence) {
		try {
			String trimmedText = text.length() > 500 ? text.substring(0, 500) : text;
			NlParseLog logEntry = NlParseLog.builder()
					.userId(userId)
					.type(txType)
					.inputText(trimmedText)
					.source(source)
					.rawLlmJson(llm != null ? llm.toJSONString() : null)
					.resultJson(JSONValue.toJSONString(result))
					.confidence(confidence)
					.build();
			nlParseLogDao.insert(sqlSession, logEntry);
		} catch (Exception e) {
			log.warn("NL_PARSE_LOG 저장 실패, 파싱 응답에는 영향 없음", e);
		}
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

	// 기본 카테고리(숨김 제외) + 이 사용자가 직접 추가한 커스텀 카테고리를 사용 빈도순으로 병합한 목록.
	// CategoryService가 유저별 개인화(추가/숨김/빈도)를 전부 처리하므로 여기서는 정적 목록을 직접 두지 않는다.
	private List<String> categoriesFor(int userId, String txType) {
		return categoryService.getMergedCategories(userId, txType);
	}

	private String buildSystemPrompt(LocalDate today, String txType, List<String> categories, List<String> topUsedCategories) {
		boolean isIncome = "IN".equals(txType);
		String subject = isIncome ? "수입" : "지출";
		String categoriesStr = String.join(", ", categories);
		String topUsedHint = topUsedCategories.isEmpty() ? "" :
				(" 참고로 이 사용자가 최근 자주 사용한 카테고리 순서는 " + String.join(", ", topUsedCategories)
						+ "입니다 — 애매하면 이 중에서 우선 고려하세요.");
		return "당신은 사용자가 프롬프트처럼 자유롭게 입력한 " + subject + " 내역을 구조화된 데이터로 추출하는 도우미입니다. "
				+ "오늘 날짜는 " + today + "입니다. '어제', '그제', '3일 전'처럼 상대적인 날짜 표현은 반드시 이 날짜를 "
				+ "기준으로 계산해 yyyy-MM-dd 형식으로 답하세요(모델 자체 학습 시점 기준으로 착각하지 마세요). "
				+ "category는 반드시 다음 목록 중 하나여야 합니다: " + categoriesStr + ". 목록에 없는 카테고리를 새로 "
				+ "만들지 마세요. amount는 텍스트에서 명확하게 찾을 수 있는 " + subject + " 금액(숫자만)을 넣고, 찾을 수 없으면 "
				+ "추측하지 말고 0으로 답하세요. currency는 기본이 KRW(원)이며, 텍스트에 '달러'·'$'·'USD'는 USD, "
				+ "'엔'·'엔화'는 JPY, '유로'·'€'는 EUR, '파운드'·'£'는 GBP, '위안'·'元'·'RMB'는 CNY, '대만달러'·'NT$'는 TWD로 "
				+ "답하세요. 외화 단위가 붙어 있으면 amount는 원화로 환산하지 말고 그 통화 기준 숫자를 그대로 넣으세요. "
				+ "merchant는 " + (isIncome ? "입금처나 수입원 이름이" : "가게/거래처 이름이")
				+ " 텍스트에 있을 때만 채우고 없으면 빈 문자열로 답하세요. confidence는 category 판단의 확신 정도를 0~1 사이 "
				+ "숫자로 답하되, " + (isIncome
						? "수입 출처가 불분명하면"
						: "'쿠팡에서 3만원'처럼 무엇을 샀는지 알 수 없어 카테고리를 특정하기 어려우면")
				+ " 낮게(0.5 이하로) 답하세요."
				+ (isIncome ? "" : (" installmentMonths는 '3개월 할부', '할부 3개월'처럼 명시적으로 할부라고 말하지 않아도, "
						+ "'5만원 2개월'처럼 금액 바로 뒤에 개월수만 붙은 구어체 표현도 할부로 간주해 그 숫자를 정수로 답하세요. "
						+ "단 '2개월 동안', '지난 2개월'처럼 기간·과거를 뜻하는 표현은 할부가 아니므로 0으로 답하고, "
						+ "할부 언급이 전혀 없거나 '일시불'이면 0으로 답하세요."))
				+ " memo에는 사용자 입력 문장에서 금액·통화 표현과 날짜 표현(오늘·어제·저번주·3월 5일 등)을 모두 제거한, "
				+ "무엇을 샀는지 또는 무슨 용도인지 설명하는 나머지 문구만 넣으세요. 가게 이름은 포함해도 되고 빼도 됩니다. "
				+ "남는 설명이 없으면 빈 문자열로 답하고, 입력 문장을 그대로 복사하지 마세요."
				+ topUsedHint;
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

		JSONObject installmentMonths = new JSONObject();
		installmentMonths.put("type", "INTEGER");

		// 통화. 기본은 KRW(원). 텍스트에 '달러/$', '엔', '유로/€', '파운드/£', '위안/元', '대만달러' 같은
		// 외화 단위가 있을 때만 해당 코드로, 그때 amount는 "그 통화 기준 금액"(환산하지 말 것).
		JSONObject currency = new JSONObject();
		currency.put("type", "STRING");
		JSONArray currencyEnum = new JSONArray();
		for (Currency c : Currency.values()) {
			currencyEnum.add(c.name());
		}
		currency.put("enum", currencyEnum);

		JSONObject properties = new JSONObject();
		properties.put("amount", amount);
		properties.put("currency", currency);
		properties.put("category", category);
		properties.put("subcategory", subcategory);
		properties.put("merchant", merchant);
		properties.put("date", date);
		properties.put("memo", memo);
		properties.put("confidence", confidence);
		properties.put("installmentMonths", installmentMonths);

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
