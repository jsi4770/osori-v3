package com.suin.fincoach.nlparse.model.service;

import java.util.List;
import java.util.Map;

public interface NlExpenseParseService {

	// 자유 텍스트를 구조화된 지출/수입 초안으로 파싱한다. 저장은 하지 않는다 — 프론트가
	// confidence를 보고 즉시 저장할지, 원탭 확인을 거칠지 결정한다.
	// type: "IN"(수입) | "OUT"(지출, 기본값) — 프론트의 수입/지출 탭 선택을 그대로 넘겨받는다.
	Map<String, Object> parse(int userId, String text, String type);

	// 사용자가 최종 확인(또는 자동 저장)한 merchant -> category 매핑을 학습 캐시에 반영하고,
	// rawText가 있으면 예시 문장 개인화를 위한 입력 이력도 함께 기록한다.
	void learn(int userId, String merchant, String category, String type, String rawText);

	// 빠른 입력창 아래 예시 칩용 — 이 사용자가 자주/최근에 쓴 문장 목록(없으면 빈 리스트).
	List<String> getExamples(int userId, String type);

}
