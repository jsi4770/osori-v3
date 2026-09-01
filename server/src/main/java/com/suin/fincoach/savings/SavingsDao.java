package com.suin.fincoach.savings;

import java.util.List;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SavingsDao {

	private static final String NS = "savingsMapper.";

	/** 지정 마감월의 "남은 예산 자동 저축" 대상 회원 + 그 달 지출 합계. */
	public List<LeftoverCandidate> findLeftoverCandidates(SqlSessionTemplate sqlSession, String yearMonth) {
		return sqlSession.selectList(NS + "findLeftoverCandidates", yearMonth);
	}

	/** 해당 (회원, 마감월)을 아직 적립 안 했으면 1행 insert하고 1 반환. */
	public int markAutoLog(SqlSessionTemplate sqlSession, int userId, String yearMonth, int amount) {
		return sqlSession.insert(NS + "markAutoLog",
				Map.of("userId", userId, "yearMonth", yearMonth, "amount", amount));
	}

	/** 저축액에 적립분을 더한다(목표 금액에서 cap). */
	public int addToSavings(SqlSessionTemplate sqlSession, int userId, int amount) {
		return sqlSession.update(NS + "addToSavings", Map.of("userId", userId, "amount", amount));
	}

	/** findLeftoverCandidates 결과 행. */
	@lombok.Data
	public static class LeftoverCandidate {
		private int userId;
		private long budget;
		private long goalAmount;
		private long currentAmount;
		private long spent;
	}
}
