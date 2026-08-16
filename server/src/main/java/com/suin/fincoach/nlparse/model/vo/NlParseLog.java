package com.suin.fincoach.nlparse.model.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NlParseLog {

	private int logId;
	private int userId;
	private String type; // "IN" | "OUT"
	private String inputText;
	private String source; // "llm" | "llm+cache" | "regex-fallback" | "regex-fallback+cache"
	private String rawLlmJson; // Gemini 원본 구조화 출력, LLM 미사용 시 null
	private String resultJson; // 정규식 이중 체크·카테고리 강제·캐시 보정까지 반영된 최종 결과
	private double confidence;

}
