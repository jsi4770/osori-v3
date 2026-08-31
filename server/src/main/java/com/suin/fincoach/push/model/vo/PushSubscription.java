package com.suin.fincoach.push.model.vo;

import java.sql.Timestamp;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 브라우저(PWA) 웹푸시 구독 한 건. PUSH_SUBSCRIPTION 테이블 매핑.
 * endpoint가 실질적인 식별자이며, 같은 사용자가 기기/브라우저마다 별도 구독을 갖는다.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PushSubscription {

	private int subId;
	private int userId;
	private String endpoint;
	private String p256dh;
	private String auth;
	private String userAgent;
	private Timestamp createdAt;
}
