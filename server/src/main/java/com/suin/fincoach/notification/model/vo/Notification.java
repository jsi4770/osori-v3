package com.suin.fincoach.notification.model.vo;

import java.time.LocalDateTime;

import lombok.Data;

/** 알림함 한 건. read는 IS_READ('Y'/'N')를 boolean으로 매핑한 값. */
@Data
public class Notification {

	private int notiId;
	private int userId;
	private String type;
	private String title;
	private String body;
	/** 클릭 시 이동할 앱 내 경로 (예: "/mypage/coaching/report"). */
	private String url;
	private boolean read;
	private LocalDateTime createdAt;
}
