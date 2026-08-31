package com.suin.fincoach.push.model.service;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.apache.http.HttpResponse;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.suin.fincoach.push.model.dao.PushSubscriptionDao;
import com.suin.fincoach.push.model.vo.PushPayload;
import com.suin.fincoach.push.model.vo.PushSubscription;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;

/**
 * 한 사용자의 모든 웹푸시 구독으로 알림을 발송한다.
 * - webpush.enabled=false거나 VAPID 키가 없으면 조용히 no-op.
 * - 발송 응답이 404/410이면 죽은 구독이므로 DB에서 제거한다.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PushNotificationService {

	private final PushService pushService;
	private final PushSubscriptionDao dao;
	private final SqlSessionTemplate sqlSession;

	@Value("${webpush.enabled:false}")
	private boolean enabled;

	/** @return 발송을 시도한 구독 수 (0이면 이 사용자는 구독이 없거나 푸시 비활성). */
	public int sendToUser(int userId, PushPayload payload) {
		if (!enabled) {
			return 0;
		}
		List<PushSubscription> subs = dao.findByUserId(sqlSession, userId);
		for (PushSubscription sub : subs) {
			sendOne(sub, payload);
		}
		return subs.size();
	}

	private void sendOne(PushSubscription sub, PushPayload payload) {
		try {
			Notification notification = new Notification(
					sub.getEndpoint(),
					sub.getP256dh(),
					sub.getAuth(),
					payload.toJson().getBytes(StandardCharsets.UTF_8));

			HttpResponse response = pushService.send(notification);
			int status = response.getStatusLine().getStatusCode();

			if (status == 404 || status == 410) {
				dao.deleteByEndpoint(sqlSession, sub.getEndpoint());
				log.info("[webpush] 만료된 구독 삭제 (status={}, endpoint={})", status, shorten(sub.getEndpoint()));
			} else if (status >= 400) {
				log.warn("[webpush] 발송 실패 status={} endpoint={}", status, shorten(sub.getEndpoint()));
			}
		} catch (Exception e) {
			log.error("[webpush] 발송 중 오류 endpoint={}", shorten(sub.getEndpoint()), e);
		}
	}

	private String shorten(String endpoint) {
		if (endpoint == null || endpoint.length() <= 60) {
			return endpoint;
		}
		return endpoint.substring(0, 60) + "...";
	}
}
