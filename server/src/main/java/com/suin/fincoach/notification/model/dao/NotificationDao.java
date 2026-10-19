package com.suin.fincoach.notification.model.dao;

import java.util.List;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.notification.model.vo.Notification;

@Repository
public class NotificationDao {

	private static final String NS = "notificationMapper.";

	/** dedupeKey가 이미 있으면 0, 새로 들어가면 1. */
	public int insert(SqlSessionTemplate sqlSession, int userId, String type, String title, String body,
			String url, String dedupeKey) {
		Map<String, Object> p = new java.util.HashMap<>();
		p.put("userId", userId);
		p.put("type", type);
		p.put("title", title);
		p.put("body", body);
		p.put("url", url);
		p.put("dedupeKey", dedupeKey);
		return sqlSession.insert(NS + "insert", p);
	}

	public List<Notification> findByUser(SqlSessionTemplate sqlSession, int userId, int limit) {
		return sqlSession.selectList(NS + "findByUser", Map.of("userId", userId, "limit", limit));
	}

	public int countUnread(SqlSessionTemplate sqlSession, int userId) {
		return sqlSession.selectOne(NS + "countUnread", userId);
	}

	public int markRead(SqlSessionTemplate sqlSession, int userId, int notiId) {
		return sqlSession.update(NS + "markRead", Map.of("userId", userId, "notiId", notiId));
	}

	public int markAllRead(SqlSessionTemplate sqlSession, int userId) {
		return sqlSession.update(NS + "markAllRead", userId);
	}

	public int delete(SqlSessionTemplate sqlSession, int userId, int notiId) {
		return sqlSession.delete(NS + "delete", Map.of("userId", userId, "notiId", notiId));
	}

	/** 지난주(월~일) 지출 요약 대상 — 지난주 또는 그 전주에 지출 기록이 있는 활성 사용자. */
	public List<WeeklyRecapRow> findWeeklyRecapRows(SqlSessionTemplate sqlSession) {
		return sqlSession.selectList(NS + "findWeeklyRecapRows");
	}

	@lombok.Data
	public static class WeeklyRecapRow {
		private int userId;
		private long lastWeek;
		private long prevWeek;
		private int txCount;
		private String topCategory;
		private long topCategoryAmount;
		/** 지난주 월요일 (yyyy-MM-dd) — dedupe 키로 쓴다. */
		private String weekStart;
	}
}
