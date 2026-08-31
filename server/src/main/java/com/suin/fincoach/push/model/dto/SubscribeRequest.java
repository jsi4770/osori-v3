package com.suin.fincoach.push.model.dto;

import lombok.Data;

/**
 * 프론트가 보내는 구독 등록 요청.
 * body 예: { "userId": 12, "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } } }
 * subscription은 브라우저 PushSubscription.toJSON() 결과를 그대로 담는다.
 */
@Data
public class SubscribeRequest {

	private Integer userId;
	private Subscription subscription;

	@Data
	public static class Subscription {
		private String endpoint;
		private Keys keys;
	}

	@Data
	public static class Keys {
		private String p256dh;
		private String auth;
	}
}
