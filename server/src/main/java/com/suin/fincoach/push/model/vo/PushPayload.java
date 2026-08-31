package com.suin.fincoach.push.model.vo;

import com.google.gson.Gson;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 서비스워커(sw.js)의 push 이벤트 핸들러가 그대로 읽는 알림 페이로드.
 * title/body/url/tag 네 필드만 쓰며 JSON 문자열로 직렬화해 발송한다.
 */
@Getter
@AllArgsConstructor
public class PushPayload {

	private static final Gson GSON = new Gson();

	private final String title;
	private final String body;
	/** 알림 클릭 시 열/포커스할 앱 내 경로 (예: "/mypage/assets"). */
	private final String url;
	/** 같은 tag의 알림은 덮어써서 쌓이지 않게 한다. */
	private final String tag;

	public String toJson() {
		return GSON.toJson(this);
	}
}
