package com.suin.fincoach.config;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.suin.fincoach.push.model.dao.PushSubscriptionDao;
import com.suin.fincoach.push.model.dao.PushSubscriptionDao.BudgetStatus;
import com.suin.fincoach.push.model.dao.PushSubscriptionDao.UpcomingFixedTrans;
import com.suin.fincoach.push.model.service.PushNotificationService;
import com.suin.fincoach.push.model.vo.PushPayload;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 웹푸시 정기 발송. 앱 전체 기준시는 FincoachApplication에서 Asia/Seoul로 고정돼 있어
 * cron도 KST 기준으로 돈다(명시적으로 zone도 지정).
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class PushSchedulerConfig {

	private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyy-MM");

	private final PushNotificationService push;
	private final PushSubscriptionDao pushDao;
	private final SqlSessionTemplate sqlSession;

	/** 매일 21:00 — 오늘의 소비 리포트 리마인더. */
	@Scheduled(cron = "0 0 21 * * *", zone = "Asia/Seoul")
	public void dailyReport() {
		List<Integer> userIds = pushDao.findUserIdsWithSubscription(sqlSession);
		if (userIds.isEmpty()) {
			return;
		}
		PushPayload payload = new PushPayload(
				"오늘의 소비 리포트",
				"오늘 지출을 기록하고 리포트를 확인해보세요.",
				"/mypage/assets",
				"daily-report");
		for (int userId : userIds) {
			push.sendToUser(userId, payload);
		}
		log.info("[webpush] 일일 리포트 리마인더 발송 대상 {}명", userIds.size());
	}

	/** 매일 20:00 — 이번 달 지출이 월 예산을 넘은 사용자에게 (달마다 1회) 경고. */
	@Scheduled(cron = "0 0 20 * * *", zone = "Asia/Seoul")
	public void budgetOverspendAlert() {
		String yearMonth = LocalDate.now().format(YM);
		List<BudgetStatus> rows = pushDao.findBudgetOverspenders(sqlSession);
		int sent = 0;
		for (BudgetStatus row : rows) {
			// 이번 달 첫 초과일 때만 1행이 실제로 들어간다 → 그때만 발송
			if (pushDao.markBudgetAlertSent(sqlSession, row.getUserId(), yearMonth) == 1) {
				long over = row.getSpent() - row.getBudget();
				push.sendToUser(row.getUserId(), new PushPayload(
						"예산 초과 알림",
						String.format("이번 달 지출이 예산을 %s원 초과했어요.", format(over)),
						"/mypage/assets",
						"budget-overspend"));
				sent++;
			}
		}
		if (sent > 0) {
			log.info("[webpush] 예산 초과 경고 발송 {}명", sent);
		}
	}

	/** 매일 09:00 — 내일 결제 예정인 고정지출 알림. */
	@Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
	public void fixedTransDueTomorrow() {
		List<UpcomingFixedTrans> rows = pushDao.findFixedTransDueTomorrow(sqlSession);
		for (UpcomingFixedTrans row : rows) {
			push.sendToUser(row.getUserId(), new PushPayload(
					"고정지출 결제 예정",
					String.format("내일 '%s' %s원이 결제될 예정이에요.", row.getName(), format(row.getAmount())),
					"/mypage/fixedTrans",
					"fixed-due"));
		}
		if (!rows.isEmpty()) {
			log.info("[webpush] 고정지출 예정 알림 발송 {}건", rows.size());
		}
	}

	private static String format(long amount) {
		return String.format("%,d", amount);
	}
}
