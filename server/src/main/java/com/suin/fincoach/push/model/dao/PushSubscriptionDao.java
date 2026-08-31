package com.suin.fincoach.push.model.dao;

import java.util.List;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.push.model.vo.PushSubscription;

@Repository
public class PushSubscriptionDao {

	private static final String NS = "pushSubscriptionMapper.";

	/** (USER_ID, ENDPOINT) 기준 upsert — 같은 구독을 다시 등록하면 키만 갱신. */
	public int upsert(SqlSessionTemplate sqlSession, PushSubscription sub) {
		return sqlSession.insert(NS + "upsert", sub);
	}

	public int deleteByEndpoint(SqlSessionTemplate sqlSession, String endpoint) {
		return sqlSession.delete(NS + "deleteByEndpoint", endpoint);
	}

	public List<PushSubscription> findByUserId(SqlSessionTemplate sqlSession, int userId) {
		return sqlSession.selectList(NS + "findByUserId", userId);
	}

	/** 구독이 하나라도 있는 사용자 USER_ID 목록 (스케줄러가 순회 대상으로 사용). */
	public List<Integer> findUserIdsWithSubscription(SqlSessionTemplate sqlSession) {
		return sqlSession.selectList(NS + "findUserIdsWithSubscription");
	}

	/** 구독 사용자 중 이번 달 지출이 월 예산(B_AMOUNT)을 넘은 사용자. */
	public List<BudgetStatus> findBudgetOverspenders(SqlSessionTemplate sqlSession) {
		return sqlSession.selectList(NS + "findBudgetOverspenders");
	}

	/** 이번 달 예산 초과 푸시를 아직 안 보냈으면 1행 insert하고 1을 반환(중복 방지). */
	public int markBudgetAlertSent(SqlSessionTemplate sqlSession, int userId, String yearMonth) {
		return sqlSession.insert(NS + "markBudgetAlertSent",
				java.util.Map.of("userId", userId, "yearMonth", yearMonth));
	}

	/** 내일 결제 예정인 고정지출(구독 사용자 한정). */
	public List<UpcomingFixedTrans> findFixedTransDueTomorrow(SqlSessionTemplate sqlSession) {
		return sqlSession.selectList(NS + "findFixedTransDueTomorrow");
	}

	/** findBudgetOverspenders 결과 행. */
	@lombok.Data
	public static class BudgetStatus {
		private int userId;
		private long budget;
		private long spent;
	}

	/** findFixedTransDueTomorrow 결과 행. */
	@lombok.Data
	public static class UpcomingFixedTrans {
		private int userId;
		private String name;
		private long amount;
	}
}
