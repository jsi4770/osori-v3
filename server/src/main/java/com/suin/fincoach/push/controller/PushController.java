package com.suin.fincoach.push.controller;

import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.suin.fincoach.push.model.dao.PushSubscriptionDao;
import com.suin.fincoach.push.model.dto.SubscribeRequest;
import com.suin.fincoach.push.model.vo.PushSubscription;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/push")
@CrossOrigin
@Slf4j
@RequiredArgsConstructor
public class PushController {

	private final PushSubscriptionDao dao;
	private final SqlSessionTemplate sqlSession;

	@Value("${webpush.vapid.public-key:}")
	private String vapidPublicKey;

	/** 프론트가 pushManager.subscribe()에 넘길 applicationServerKey. */
	@GetMapping("/vapidPublicKey")
	public ResponseEntity<?> vapidPublicKey() {
		return ResponseEntity.ok(Map.of("publicKey", vapidPublicKey == null ? "" : vapidPublicKey.trim()));
	}

	@PostMapping("/subscribe")
	public ResponseEntity<?> subscribe(@RequestBody SubscribeRequest req,
			@RequestHeader(value = "User-Agent", required = false) String userAgent) {

		if (req.getUserId() == null || req.getSubscription() == null
				|| req.getSubscription().getEndpoint() == null
				|| req.getSubscription().getKeys() == null) {
			return ResponseEntity.badRequest().body(Map.of("message", "구독 정보가 올바르지 않습니다."));
		}

		SubscribeRequest.Subscription s = req.getSubscription();
		PushSubscription sub = PushSubscription.builder()
				.userId(req.getUserId())
				.endpoint(s.getEndpoint())
				.p256dh(s.getKeys().getP256dh())
				.auth(s.getKeys().getAuth())
				.userAgent(userAgent == null ? null : userAgent.substring(0, Math.min(userAgent.length(), 390)))
				.build();

		try {
			dao.upsert(sqlSession, sub);
		} catch (DataIntegrityViolationException e) {
			// 존재하지 않는 userId 등 FK 위반 — 클라이언트 요청 문제이므로 400
			log.warn("push subscribe 실패 (userId={} 무결성 위반)", req.getUserId());
			return ResponseEntity.badRequest().body(Map.of("message", "유효하지 않은 사용자입니다. 다시 로그인해주세요."));
		}
		return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "구독 완료"));
	}

	@PostMapping("/unsubscribe")
	public ResponseEntity<?> unsubscribe(@RequestBody Map<String, String> body) {
		String endpoint = body.get("endpoint");
		if (endpoint == null || endpoint.isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("message", "endpoint가 필요합니다."));
		}
		dao.deleteByEndpoint(sqlSession, endpoint);
		return ResponseEntity.ok(Map.of("message", "구독 해지 완료"));
	}
}
