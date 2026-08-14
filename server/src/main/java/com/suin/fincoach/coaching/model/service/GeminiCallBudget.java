package com.suin.fincoach.coaching.model.service;

import java.time.LocalDate;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

// 실제 Gemini 호출이 일어나는 모든 엔드포인트(nlparse/코칭/챌린지)가 공유하는 일일 호출 카운터.
// 구글의 무료 티어 한도는 API 키가 아니라 프로젝트+모델 단위라서, 컨트롤러마다 따로 세면
// 실제 한도를 반영하지 못하고 이중으로 카운트하는 셈이 된다. 그래서 하나의 빈으로 공유한다.
// DB(GEMINI_CALL_BUDGET)에 저장한다 — 메모리 카운터였을 때는 배포/헬스체크 재시작마다 리셋돼서
// "하루 한도"가 사실상 보장되지 않았다.
@Component
public class GeminiCallBudget {

	@Autowired
	private SqlSessionTemplate sqlSession;

	public int incrementAndGetTodayCalls() {
		LocalDate today = LocalDate.now();
		return sqlSession.selectOne("geminiCallBudgetMapper.incrementAndGetTodayCalls", today);
	}

}
