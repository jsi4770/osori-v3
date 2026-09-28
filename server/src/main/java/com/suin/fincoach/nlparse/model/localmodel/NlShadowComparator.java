package com.suin.fincoach.nlparse.model.localmodel;

import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadLocalRandom;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

import com.suin.fincoach.nlparse.model.dao.NlShadowLogDao;
import com.suin.fincoach.nlparse.model.vo.NlShadowLog;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

/**
 * 파싱 응답을 반환한 뒤, 같은 입력에 자체 모델을 돌려 Gemini 결과와 비교해 NL_SHADOW_LOG 에 남긴다.
 * fire-and-forget(단일 스레드 풀) 이라 파싱 지연/실패에 전혀 영향을 주지 않는다.
 * {@link NlLocalModel} 빈이 있을 때만(=nlparse.localmodel.enabled=true) 활성화된다.
 */
@Component
@ConditionalOnBean(NlLocalModel.class)
@Slf4j
public class NlShadowComparator {

	private final NlLocalModel model;
	private final NlShadowLogDao dao;
	private final SqlSessionTemplate sqlSession;
	private final ExecutorService pool = Executors.newSingleThreadExecutor(r -> {
		Thread t = new Thread(r, "nlparse-shadow");
		t.setDaemon(true);
		return t;
	});

	/** 0.0~1.0. 트래픽이 많아지면 낮춰 표본만 비교. */
	@Value("${nlparse.shadow.sample-rate:1.0}")
	private double sampleRate;

	@Autowired
	public NlShadowComparator(NlLocalModel model, NlShadowLogDao dao, SqlSessionTemplate sqlSession) {
		this.model = model;
		this.dao = dao;
		this.sqlSession = sqlSession;
	}

	public void compareAsync(int userId, String type, String text, Map<String, Object> geminiResult) {
		if (!model.isReady() || ThreadLocalRandom.current().nextDouble() >= sampleRate) {
			return;
		}
		// geminiResult 는 서비스 스레드가 계속 건드릴 수 있으니 필요한 값만 지금 복사.
		String geminiCategory = str(geminiResult.get("category"));
		String geminiMerchant = str(geminiResult.get("merchant"));
		pool.submit(() -> run(userId, type, text, geminiCategory, geminiMerchant));
	}

	private void run(int userId, String type, String text, String geminiCategory, String geminiMerchant) {
		try {
			NlLocalModel.Prediction p = model.predict(text, type);
			if (p == null) {
				return;
			}
			NlShadowLog row = NlShadowLog.builder()
					.userId(userId)
					.type("IN".equalsIgnoreCase(type) ? "IN" : "OUT")
					.inputText(text.length() > 500 ? text.substring(0, 500) : text)
					.geminiCategory(geminiCategory)
					.geminiMerchant(geminiMerchant)
					.modelCategory(p.category())
					.modelMerchant(p.merchant())
					.categoryAgree(eq(geminiCategory, p.category()))
					.merchantAgree(merchantEq(geminiMerchant, p.merchant()))
					.modelMillis(p.inferMillis())
					.build();
			dao.insert(sqlSession, row);
		} catch (Exception e) {
			log.debug("섀도우 비교 기록 실패(무시): {}", e.toString());
		}
	}

	private static String str(Object o) {
		return o == null ? null : String.valueOf(o);
	}

	private static boolean eq(String a, String b) {
		return a == null ? b == null : a.equals(b);
	}

	// merchant 는 표기 흔들림("스벅"/"스타벅스")이 흔해 느슨하게: 공백 제거 + 소문자 후 포함 관계면 일치로 본다.
	private static boolean merchantEq(String a, String b) {
		if (a == null && b == null) {
			return true;
		}
		if (a == null || b == null) {
			return false;
		}
		String na = a.replaceAll("\\s+", "").toLowerCase();
		String nb = b.replaceAll("\\s+", "").toLowerCase();
		return na.equals(nb) || na.contains(nb) || nb.contains(na);
	}

	@PreDestroy
	void shutdown() {
		pool.shutdownNow();
	}
}
