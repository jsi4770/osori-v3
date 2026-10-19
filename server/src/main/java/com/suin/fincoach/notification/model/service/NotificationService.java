package com.suin.fincoach.notification.model.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Service;

import com.suin.fincoach.notification.model.dao.NotificationDao;
import com.suin.fincoach.notification.model.dao.NotificationDao.WeeklyRecapRow;
import com.suin.fincoach.push.model.service.PushNotificationService;
import com.suin.fincoach.push.model.vo.PushPayload;

import lombok.RequiredArgsConstructor;

/**
 * 알림의 단일 진입점: 알림함(NOTIFICATION)에 먼저 기록하고, 새로 기록된 경우에만 웹푸시를 보낸다.
 * 푸시 구독이 없는 사용자도 알림함에는 쌓인다.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

	public static final String WEEKLY_RECAP = "WEEKLY_RECAP";
	public static final String BUDGET_OVER = "BUDGET_OVER";
	public static final String FIXED_DUE = "FIXED_DUE";

	private final NotificationDao dao;
	private final PushNotificationService push;
	private final SqlSessionTemplate sqlSession;

	/**
	 * @param dedupeKey 같은 키로 이미 기록돼 있으면 아무것도 하지 않는다(null이면 항상 기록).
	 * @return 새로 기록했으면 true
	 */
	public boolean notify(int userId, String type, String title, String body, String url, String dedupeKey) {
		if (dedupeKey != null && dedupeKey.length() > 100) {
			dedupeKey = dedupeKey.substring(0, 100);
		}
		if (dao.insert(sqlSession, userId, type, title, body, url, dedupeKey) != 1) {
			return false;
		}
		push.sendToUser(userId, new PushPayload(title, body, url, type.toLowerCase()));
		return true;
	}

	/** 지난주 소비 리캡 알림 본문. */
	public static String recapBody(WeeklyRecapRow row) {
		StringBuilder sb = new StringBuilder();
		sb.append(String.format("지난주 총 %s원을 썼어요.", format(row.getLastWeek())));
		if (row.getPrevWeek() > 0) {
			long diff = row.getLastWeek() - row.getPrevWeek();
			long pct = Math.round(Math.abs(diff) * 100.0 / row.getPrevWeek());
			if (pct == 0) {
				sb.append(" 그 전주와 비슷해요.");
			} else {
				sb.append(String.format(" 그 전주보다 %d%% %s.", pct, diff > 0 ? "늘었어요" : "줄었어요"));
			}
		}
		if (row.getTopCategory() != null) {
			sb.append(String.format(" 가장 많이 쓴 곳은 %s(%s원)이에요.", row.getTopCategory(), format(row.getTopCategoryAmount())));
		}
		return sb.toString();
	}

	/**
	 * 사용자 본인이 요청한 리캡 — 정기 발송과 같은 내용을 지금 만들어 알림함에 기록하고 푸시도 보낸다.
	 * 분 단위 dedupe 키라 같은 분에 연타해도 한 건만 생긴다.
	 * @return 새로 기록했으면 true
	 */
	public boolean sendRecapNow(int userId) {
		List<WeeklyRecapRow> rows = dao.findWeeklyRecapRows(sqlSession, userId);
		String body = rows.isEmpty()
				? "지난주에는 기록된 지출이 없어요. 지출을 기록하면 매주 월요일에 리캡을 보내드려요."
				: recapBody(rows.get(0));
		String minute = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmm"));
		return notify(userId, WEEKLY_RECAP, "지난주 소비 리캡", body, "/mypage/coaching/report",
				"WEEKLY_RECAP:manual:" + minute);
	}

	private static String format(long amount) {
		return String.format("%,d", amount);
	}
}
