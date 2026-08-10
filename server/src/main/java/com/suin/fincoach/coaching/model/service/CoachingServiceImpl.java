package com.suin.fincoach.coaching.model.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.json.simple.JSONArray;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.suin.fincoach.coaching.model.dao.CoachingDao;
import com.suin.fincoach.coaching.model.dao.TrendDao;
import com.suin.fincoach.coaching.model.vo.AnomalyItem;
import com.suin.fincoach.coaching.model.vo.CoachingMessage;
import com.suin.fincoach.coaching.model.vo.SpendingTrend;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class CoachingServiceImpl implements CoachingService {

	@Autowired
	private CoachingDao dao;

	@Autowired
	private TrendDao trendDao;

	@Autowired
	private SqlSessionTemplate sqlSession;

	@Autowired
	private GeminiClient geminiClient;

	// Gemini는 무료 티어라도 호출 실패/한도 초과가 있을 수 있어, 꺼져 있거나 오류일 때는 Mock으로 우아하게 대체한다.
	@Value("${coaching.llm.enabled:false}")
	private boolean llmEnabled;

	private static final String NUDGE_SYSTEM_PROMPT =
			"당신은 이제 막 취업한 사회초년생을 위한 개인 재무 코치입니다. 다정하지만 직설적인 톤으로, 왜 그런 소비가 생겼을지 "
			+ "맥락을 살짝 짚어주고 실천할 수 있는 작은 대안을 하나 제안하세요. 잔소리하지 말고 응원하는 느낌으로. "
			+ "모바일 넛지 카드에 들어갈 내용이므로 반드시 1~2문장 이내로 짧고 간결하게, 한국어로만 답하세요.";

	private static final String COMPOSITE_NUDGE_SYSTEM_PROMPT =
			"당신은 이제 막 취업한 사회초년생을 위한 개인 재무 코치입니다. 사용자의 이번 달 여러 카테고리 이상 지출을 한 번에 보고 "
			+ "종합적으로 진단하세요. 그중 가장 신경 써야 할 카테고리 하나를 짚어 작은 실천 대안을 제안하고, 나머지는 짧게만 언급하세요. "
			+ "잔소리하지 말고 응원하는 느낌으로. 모바일 넛지 카드에 들어갈 내용이므로 반드시 1~2문장 이내로 짧고 간결하게, 한국어로만 답하세요.";

	private static final String CHAT_SYSTEM_PROMPT =
			"당신은 사회초년생을 위한 개인 재무 코치입니다. 방금 보낸 소비 진단에서 이어지는 대화를 진행합니다. "
			+ "사용자의 지출 카테고리와 금액은 이미 알고 있으니, 되묻지 말고 그 정보를 근거로 바로 분석하고 "
			+ "구체적인 해결책(예산 조정, 대체 습관 등 실행 가능한 방법)을 먼저 제시하세요. 되묻는 질문은 "
			+ "정말 필요할 때 한 번만 하고, 답을 찾겠다고 여러 차례 캐묻지 마세요. 설교하지 말고 담백하고 "
			+ "실용적으로, 2~3문장, 한국어로만 답하세요.";

	private static final String TREND_SYSTEM_PROMPT =
			"당신은 이제 막 취업한 사회초년생을 위한 개인 재무 코치입니다. 사용자의 여러 달치 카테고리별 지출 데이터에서 "
			+ "가장 눈에 띄는 흐름 하나만 골라, 그에 대한 짧은 조언과 함께 답하세요. 데이터에 '눈에 띄게 달라진 카테고리 총 N개'라는 "
			+ "안내가 있으면, 그 개수만 짧게 한 문장으로 덧붙이세요(다른 카테고리 이름은 언급하지 마세요). 그런 안내가 없으면 "
			+ "언급하지 마세요. 잔소리하지 말고 다정하게, 군더더기 없이 핵심만 담아 최대 3문장, 한국어로만 답하세요.";

	private static final String COMPOSITION_SYSTEM_PROMPT =
			"당신은 이제 막 취업한 사회초년생을 위한 개인 재무 코치입니다. 사용자는 아직 이번 한 달치 지출 데이터만 있습니다. "
			+ "이번 달 지출이 가장 집중된 카테고리 하나만 짚어 짧은 조언과 함께 답하세요. 다정하게, "
			+ "군더더기 없이 핵심만 담아 최대 2문장, 한국어로만 답하세요.";

	@Override
	public CoachingMessage generateNudge(int userId, String category, int amount, int avgAmount) {
		// 홈 화면 방문마다 같은 이상치가 재감지되어도, 오늘 이미 같은 카테고리+금액으로 만든 넛지가 있으면
		// 그걸 그대로 재사용한다(중복 행 적재 및 불필요한 Gemini 호출 방지).
		CoachingMessage existing = dao.selectTodayNudge(sqlSession, userId, category, amount);
		if (existing != null) {
			existing.setThreadId(existing.getMessageId());
			return existing;
		}

		String content = null;
		if (llmEnabled) {
			JSONArray contents = new JSONArray();
			contents.add(geminiClient.userTurn(buildNudgePrompt(category, amount, avgAmount)));
			content = geminiClient.generateText(NUDGE_SYSTEM_PROMPT, contents);
		}
		if (content == null) {
			content = mockNudge(category, amount, avgAmount);
		}

		CoachingMessage nudge = CoachingMessage.builder()
				.userId(userId)
				.threadId(0) // 0 → mapper가 SEQ_COACHING.CURRVAL(=자기 messageId)로 채움
				.role("NUDGE")
				.content(content)
				.category(category)
				.originalAmount(amount)
				.avgAmount(avgAmount)
				.build();

		dao.insertMessage(sqlSession, nudge);
		nudge.setThreadId(nudge.getMessageId()); // 반환 객체에도 self-thread 반영
		return nudge;
	}

	@Override
	public CoachingMessage generateCompositeNudge(int userId, List<AnomalyItem> anomalies) {
		// 카테고리를 정렬해 join한 문자열을 캐시 키로 사용 — 오늘 같은 조합으로 이미 진단받았으면 재사용.
		String categoryKey = anomalies.stream()
				.map(AnomalyItem::getCategory)
				.sorted()
				.collect(Collectors.joining(","));

		CoachingMessage existing = dao.selectTodayCompositeNudge(sqlSession, userId, categoryKey);
		if (existing != null) {
			existing.setThreadId(existing.getMessageId());
			return existing;
		}

		String content = null;
		if (llmEnabled) {
			JSONArray contents = new JSONArray();
			contents.add(geminiClient.userTurn(buildCompositeNudgePrompt(anomalies)));
			content = geminiClient.generateText(COMPOSITE_NUDGE_SYSTEM_PROMPT, contents);
		}
		if (content == null) {
			content = mockCompositeNudge(anomalies);
		}

		// 카테고리별로 이번/평소 금액이 제각각이라 단일 컬럼에 합산해도 의미가 없으므로, 원본/평균 금액은 비워둔다
		// (성장 리포트의 "이번 N원 · 평소 N원" 표시는 둘 다 null일 때 자동으로 생략된다).
		CoachingMessage nudge = CoachingMessage.builder()
				.userId(userId)
				.threadId(0)
				.role("NUDGE")
				.content(content)
				.category(categoryKey)
				.build();

		dao.insertMessage(sqlSession, nudge);
		nudge.setThreadId(nudge.getMessageId());
		return nudge;
	}

	@Override
	public CoachingMessage continueChat(int threadId, int userId, String userMessage) {
		List<CoachingMessage> history = dao.selectThread(sqlSession, threadId);

		String reply = null;
		if (llmEnabled) {
			JSONArray contents = new JSONArray();
			for (CoachingMessage msg : history) {
				// NUDGE와 COACH는 model 턴, USER는 user 턴으로 매핑
				String geminiRole = "USER".equals(msg.getRole()) ? "user" : "model";
				contents.add(geminiClient.turn(geminiRole, msg.getContent()));
			}
			contents.add(geminiClient.userTurn(userMessage));
			reply = geminiClient.generateText(CHAT_SYSTEM_PROMPT, contents);
		}
		if (reply == null) {
			reply = mockChatReply();
		}

		CoachingMessage userRow = CoachingMessage.builder()
				.userId(userId).threadId(threadId).role("USER").content(userMessage).build();
		dao.insertMessage(sqlSession, userRow);

		CoachingMessage coachRow = CoachingMessage.builder()
				.userId(userId).threadId(threadId).role("COACH").content(reply).build();
		dao.insertMessage(sqlSession, coachRow);

		return coachRow;
	}

	@Override
	public List<CoachingMessage> getGrowthReport(int userId) {
		return dao.selectRecentNudges(sqlSession, userId);
	}

	@Override
	public SpendingTrend getSpendingTrend(int userId, String yearMonth, List<Map<String, Object>> monthlyTotals) {
		SpendingTrend cached = trendDao.selectTrend(sqlSession, userId, yearMonth);
		if (cached != null) {
			return cached;
		}

		String content = null;
		if (llmEnabled) {
			String systemPrompt = monthlyTotals.size() >= 2 ? TREND_SYSTEM_PROMPT : COMPOSITION_SYSTEM_PROMPT;
			JSONArray contents = new JSONArray();
			contents.add(geminiClient.userTurn(buildTrendPrompt(monthlyTotals)));
			content = geminiClient.generateText(systemPrompt, contents);
		}
		if (content == null) {
			content = mockTrend(monthlyTotals);
		}

		SpendingTrend trend = SpendingTrend.builder()
				.userId(userId)
				.yearMonth(yearMonth)
				.content(content)
				.build();
		trendDao.insertTrend(sqlSession, trend);

		// 동시 요청 경합 시 UNIQUE(user_id, year_month) + ON CONFLICT DO NOTHING로 내 insert가
		// 무시될 수 있으므로, 항상 재조회해서 실제로 저장된(먼저 이긴) 결과를 반환한다.
		SpendingTrend persisted = trendDao.selectTrend(sqlSession, userId, yearMonth);
		return persisted != null ? persisted : trend;
	}

	@Override
	public SpendingTrend peekCachedTrend(int userId, String yearMonth) {
		return trendDao.selectTrend(sqlSession, userId, yearMonth);
	}

	// ---- 프롬프트 빌더 ----

	private String buildNudgePrompt(String category, int amount, int avgAmount) {
		String cat = (category == null || category.isBlank()) ? "이 카테고리" : category;
		return String.format(
				"사용자의 '%s' 지출이 %,d원으로, 평소 평균 %,d원보다 높게 감지됐어요. "
				+ "이 상황에 맞는 넛지 코칭 한마디를 건네주세요.",
				cat, amount, avgAmount);
	}

	private String buildCompositeNudgePrompt(List<AnomalyItem> anomalies) {
		StringBuilder sb = new StringBuilder("사용자의 이번 달 카테고리별 이상 지출은 다음과 같습니다.\n");
		for (AnomalyItem a : anomalies) {
			sb.append(String.format("- %s: 이번 %,d원 (평소 평균 %,d원)%n", a.getCategory(), a.getOriginalAmount(), a.getAvgAmount()));
		}
		sb.append("이 정보를 바탕으로 전체적으로 진단하고, 그중 우선순위가 높은 것 하나를 짚어 조언해주세요.");
		return sb.toString();
	}

	private String buildTrendPrompt(List<Map<String, Object>> monthlyTotals) {
		StringBuilder sb = new StringBuilder();
		if (monthlyTotals.size() >= 2) {
			sb.append("사용자의 최근 ").append(monthlyTotals.size()).append("개월간 카테고리별 지출 데이터입니다.\n");
		} else {
			sb.append("사용자의 이번 달 카테고리별 지출 데이터입니다.\n");
		}
		for (Map<String, Object> month : monthlyTotals) {
			String ym = String.valueOf(month.get("yearMonth"));
			@SuppressWarnings("unchecked")
			Map<String, Object> categories = (Map<String, Object>) month.get("categories");
			sb.append(ym).append(": ");
			if (categories != null) {
				categories.forEach((cat, amount) ->
						sb.append(cat).append(" ").append(formatAmount(amount)).append("원, "));
			}
			sb.append("\n");
		}

		// 이상 지출이 2개 이상이어도 본문엔 1개만 짚되, "그 외 N개"로 존재는 알 수 있게 —
		// 실제 개수는 여기서 미리 계산해 사실로 못박아 LLM이 지어내지 않게 한다.
		if (monthlyTotals.size() >= 2) {
			Map<String, Object> latest = monthlyTotals.get(monthlyTotals.size() - 1);
			Map<String, Object> previous = monthlyTotals.get(monthlyTotals.size() - 2);
			@SuppressWarnings("unchecked")
			Map<String, Object> latestCats = (Map<String, Object>) latest.get("categories");
			@SuppressWarnings("unchecked")
			Map<String, Object> prevCats = (Map<String, Object>) previous.get("categories");
			int notableCount = countNotableChanges(latestCats, prevCats);
			if (notableCount >= 2) {
				sb.append("참고: 지난달 대비 지출이 눈에 띄게 달라진(20% 이상 변화) 카테고리는 총 ")
						.append(notableCount).append("개입니다.\n");
			}
		}

		sb.append("이 데이터를 바탕으로 분석과 조언을 해주세요.");
		return sb.toString();
	}

	// 지난달 대비 20% 이상 + 최소 1만원 이상 달라진(늘거나 준) 카테고리 개수 — 노이즈성 소액 변화는 제외
	private int countNotableChanges(Map<String, Object> latestCats, Map<String, Object> prevCats) {
		if (latestCats == null) return 0;
		int count = 0;
		for (Map.Entry<String, Object> entry : latestCats.entrySet()) {
			long latestAmount = toLong(entry.getValue());
			long prevAmount = prevCats == null ? 0 : toLong(prevCats.get(entry.getKey()));
			long diff = Math.abs(latestAmount - prevAmount);
			if (diff < 10_000) continue;
			boolean pctNotable = prevAmount > 0 && diff * 100.0 / prevAmount >= 20.0;
			boolean newCategoryNotable = prevAmount == 0 && latestAmount >= 10_000;
			if (pctNotable || newCategoryNotable) count++;
		}
		return count;
	}

	private String formatAmount(Object amount) {
		if (amount instanceof Number) {
			return String.format("%,d", ((Number) amount).longValue());
		}
		return String.valueOf(amount);
	}

	// ---- Mock (비활성/오류/무료 티어 한도 초과 시 우아한 대체) ----

	private String mockNudge(String category, int amount, int avgAmount) {
		String cat = (category == null || category.isBlank()) ? "이번 소비" : category;
		if (avgAmount > 0 && amount > avgAmount) {
			int pct = (int) Math.round((amount - avgAmount) * 100.0 / avgAmount);
			return String.format(
					"이번 %s 지출이 %,d원으로 평소 평균(%,d원)보다 %d%% 많아요. "
					+ "다음 결제 전에 '이게 지금 꼭 필요한가?' 한 번만 되물어볼까요?",
					cat, amount, avgAmount, pct);
		}
		return String.format(
				"이번 %s 지출은 %,d원으로, 지금 페이스면 이번 달 예산 관리는 순조로워요.",
				cat, amount);
	}

	private String mockCompositeNudge(List<AnomalyItem> anomalies) {
		AnomalyItem top = anomalies.stream()
				.max(Comparator.comparingDouble(a -> a.getAvgAmount() > 0
						? (double) (a.getOriginalAmount() - a.getAvgAmount()) / a.getAvgAmount()
						: a.getOriginalAmount()))
				.orElse(anomalies.get(0));
		int pct = top.getAvgAmount() > 0
				? (int) Math.round((top.getOriginalAmount() - top.getAvgAmount()) * 100.0 / top.getAvgAmount())
				: 0;

		StringBuilder sb = new StringBuilder(String.format(
				"이번 달은 %s 지출이 평소보다 %d%% 많아 가장 눈에 띄어요.", top.getCategory(), pct));

		long otherCount = anomalies.size() - 1;
		if (otherCount == 1) {
			String otherCategory = anomalies.stream()
					.filter(a -> a != top)
					.findFirst()
					.map(AnomalyItem::getCategory)
					.orElse("다른 카테고리");
			sb.append(String.format(" %s도 함께 살펴보면 좋아요.", otherCategory));
		} else if (otherCount > 1) {
			sb.append(String.format(" 그 외 %d개 카테고리도 함께 살펴보면 좋아요.", otherCount));
		}
		return sb.toString();
	}

	private String mockChatReply() {
		return "좋아요, 그렇게 마음먹은 것만으로도 첫걸음이에요. "
				+ "이번 주에 딱 한 가지만 바꿔본다면 무엇부터 시작해볼까요? "
				+ "예를 들어 배달 앱을 주 2회로 줄이는 것처럼 작고 구체적인 목표가 오래 가요.";
	}

	private String mockTrend(List<Map<String, Object>> monthlyTotals) {
		if (monthlyTotals.size() < 2) {
			return "이번 달 소비 데이터를 모으는 중이에요. 계속 기록하시면 다음 달엔 더 자세한 흐름 분석을 보여드릴게요!";
		}

		Map<String, Object> latest = monthlyTotals.get(monthlyTotals.size() - 1);
		Map<String, Object> previous = monthlyTotals.get(monthlyTotals.size() - 2);

		@SuppressWarnings("unchecked")
		Map<String, Object> latestCats = (Map<String, Object>) latest.get("categories");
		@SuppressWarnings("unchecked")
		Map<String, Object> prevCats = (Map<String, Object>) previous.get("categories");

		String biggestIncreaseCat = null;
		long biggestIncrease = 0;

		if (latestCats != null) {
			for (Map.Entry<String, Object> entry : latestCats.entrySet()) {
				long latestAmount = toLong(entry.getValue());
				long prevAmount = prevCats == null ? 0 : toLong(prevCats.get(entry.getKey()));
				long diff = latestAmount - prevAmount;
				if (diff > biggestIncrease) {
					biggestIncrease = diff;
					biggestIncreaseCat = entry.getKey();
				}
			}
		}

		if (biggestIncreaseCat == null) {
			return "지난달 대비 지출 패턴이 안정적으로 유지되고 있어요. 이 흐름을 계속 이어가 볼까요?";
		}

		String base = String.format(
				"지난달 대비 '%s' 지출이 %,d원 늘었어요. 다음 달엔 이 카테고리부터 한 번 점검해보는 건 어떨까요?",
				biggestIncreaseCat, biggestIncrease);

		int notableCount = countNotableChanges(latestCats, prevCats);
		if (notableCount >= 2) {
			base += String.format(" 그 외 %d개 카테고리도 변화가 있었어요.", notableCount - 1);
		}
		return base;
	}

	private long toLong(Object value) {
		if (value instanceof Number) {
			return ((Number) value).longValue();
		}
		try {
			return Long.parseLong(String.valueOf(value));
		} catch (Exception e) {
			return 0;
		}
	}

}
