package com.suin.fincoach.config;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.suin.fincoach.savings.SavingsDao;
import com.suin.fincoach.savings.SavingsDao.LeftoverCandidate;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * "남은 예산 자동 저축": SAVINGS_AUTO_FILL='Y'인 회원에 대해, 지난달(마감된 달)의
 * 안 쓴 예산 = max(0, B_AMOUNT - 지난달 지출)을 SAVINGS_CURRENT_AMOUNT에 더한다.
 * - 목표 금액에서 cap, 목표일이 지난 달부터는 중단
 * - SAVINGS_AUTO_LOG(USER_ID, YEAR_MONTH) 로 사용자당 마감월 1회만 적립되도록 멱등 보장
 * - 매일 새벽에 돌아 놓친 날이 있어도 로그가 없으면 다음날 catch-up 된다
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class SavingsSchedulerConfig {

	private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyy-MM");
	private static final ZoneId KST = ZoneId.of("Asia/Seoul");

	private final SavingsDao dao;
	private final SqlSessionTemplate sqlSession;

	/** 매일 01:10 KST — 지난달 남은 예산을 자동 저축 적립. */
	@Scheduled(cron = "0 10 1 * * *", zone = "Asia/Seoul")
	public void autoFillSavingsFromLeftover() {
		String lastMonth = LocalDate.now(KST).minusMonths(1).format(YM);

		int applied = 0;
		long total = 0;
		for (LeftoverCandidate c : dao.findLeftoverCandidates(sqlSession, lastMonth)) {
			long leftover = Math.max(0, c.getBudget() - c.getSpent());
			long room = Math.max(0, c.getGoalAmount() - c.getCurrentAmount());
			long contribution = Math.min(leftover, room);
			if (contribution <= 0) {
				continue;
			}
			// insert가 실제로 들어갔을 때(=이 달 첫 적립)만 저축액을 올린다
			if (dao.markAutoLog(sqlSession, c.getUserId(), lastMonth, (int) contribution) == 1) {
				dao.addToSavings(sqlSession, c.getUserId(), (int) contribution);
				applied++;
				total += contribution;
			}
		}

		if (applied > 0) {
			log.info("[savings] {} 남은 예산 자동 적립 — {}명 / 합계 {}원", lastMonth, applied, String.format("%,d", total));
		}
	}
}
