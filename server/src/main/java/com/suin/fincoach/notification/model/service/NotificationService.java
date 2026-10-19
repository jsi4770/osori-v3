package com.suin.fincoach.notification.model.service;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Service;

import com.suin.fincoach.notification.model.dao.NotificationDao;
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
}
