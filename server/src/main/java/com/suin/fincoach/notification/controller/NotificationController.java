package com.suin.fincoach.notification.controller;

import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.suin.fincoach.notification.model.dao.NotificationDao;
import com.suin.fincoach.notification.model.service.NotificationService;

import lombok.RequiredArgsConstructor;

/** 알림함 API. 다른 컨트롤러와 같은 규약으로 userId를 요청에 실어 받는다. */
@RestController
@RequestMapping("/notification")
@CrossOrigin
@RequiredArgsConstructor
public class NotificationController {

	private final NotificationDao dao;
	private final SqlSessionTemplate sqlSession;
	private final NotificationService notifications;

	/** 최근 알림 목록 + 안 읽은 개수. */
	@GetMapping
	public ResponseEntity<?> list(@RequestParam int userId, @RequestParam(defaultValue = "50") int limit) {
		int capped = Math.max(1, Math.min(limit, 100));
		return ResponseEntity.ok(Map.of(
				"items", dao.findByUser(sqlSession, userId, capped),
				"unreadCount", dao.countUnread(sqlSession, userId)));
	}

	/** 뱃지용 가벼운 조회. */
	@GetMapping("/unread-count")
	public ResponseEntity<?> unreadCount(@RequestParam int userId) {
		return ResponseEntity.ok(Map.of("unreadCount", dao.countUnread(sqlSession, userId)));
	}

	@PostMapping("/{notiId}/read")
	public ResponseEntity<?> read(@PathVariable int notiId, @RequestParam int userId) {
		dao.markRead(sqlSession, userId, notiId);
		return ResponseEntity.ok(Map.of("unreadCount", dao.countUnread(sqlSession, userId)));
	}

	/** "리캡 지금 받기" — 본인의 지난주 리캡을 지금 알림함에 만들고 푸시도 보낸다. */
	@PostMapping("/recap-now")
	public ResponseEntity<?> recapNow(@RequestParam int userId) {
		boolean created = notifications.sendRecapNow(userId);
		return ResponseEntity.ok(Map.of("created", created, "unreadCount", dao.countUnread(sqlSession, userId)));
	}

	@PostMapping("/read-all")
	public ResponseEntity<?> readAll(@RequestParam int userId) {
		dao.markAllRead(sqlSession, userId);
		return ResponseEntity.ok(Map.of("unreadCount", 0));
	}

	@DeleteMapping("/{notiId}")
	public ResponseEntity<?> delete(@PathVariable int notiId, @RequestParam int userId) {
		dao.delete(sqlSession, userId, notiId);
		return ResponseEntity.ok(Map.of("unreadCount", dao.countUnread(sqlSession, userId)));
	}
}
