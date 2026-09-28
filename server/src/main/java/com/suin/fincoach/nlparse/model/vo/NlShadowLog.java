package com.suin.fincoach.nlparse.model.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 섀도우 비교 로그 — 프로덕션 응답은 Gemini 그대로 쓰면서, 자체 모델 예측을 나란히 기록해
 * 불일치를 모은다. category/merchant 만 자체 모델이 담당하므로 그 둘만 비교한다.
 */
@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NlShadowLog {

	private int logId;
	private int userId;
	private String type;            // "IN" | "OUT"
	private String inputText;

	private String geminiCategory;
	private String geminiMerchant;
	private String modelCategory;
	private String modelMerchant;

	private boolean categoryAgree;
	private boolean merchantAgree;  // 둘 다 null 이거나 정규화 후 동일하면 true
	private long modelMillis;
}
