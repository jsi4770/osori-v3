package com.suin.fincoach.util;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 아주 가벼운 인메모리 고정 윈도우 레이트리미터. 단일 인스턴스 기준이며 재시작 시 초기화된다.
 * 인증코드 발송처럼 "완벽한 분산 제한"까지는 필요 없고, 한 IP가 남의 이메일로 코드를 대량 발송해
 * Brevo 쿼터를 태우거나 발신 평판을 떨어뜨리는 것을 막는 용도.
 */
@Component
public class SimpleRateLimiter {

	private static final class Window {
		long startMs;
		int count;
	}

	private final Map<String, Window> windows = new ConcurrentHashMap<>();

	/** key에 대해 windowMs 동안 max회까지 허용. 허용되면 카운트를 올리고 true. */
	public synchronized boolean allow(String key, int max, long windowMs) {
		long now = System.currentTimeMillis();
		Window w = windows.computeIfAbsent(key, k -> new Window());
		if (now - w.startMs > windowMs) {
			w.startMs = now;
			w.count = 0;
		}
		if (w.count >= max) {
			return false;
		}
		w.count++;
		// 맵이 무한정 커지지 않도록 가끔 만료된 항목 정리
		if (windows.size() > 5000) {
			windows.entrySet().removeIf(e -> now - e.getValue().startMs > windowMs);
		}
		return true;
	}

	/** Railway 등 리버스 프록시 뒤에서는 X-Forwarded-For의 첫 IP가 실제 클라이언트다. */
	public static String clientIp(HttpServletRequest request) {
		String xff = request.getHeader("X-Forwarded-For");
		if (xff != null && !xff.isBlank()) {
			return xff.split(",")[0].trim();
		}
		return request.getRemoteAddr();
	}
}
