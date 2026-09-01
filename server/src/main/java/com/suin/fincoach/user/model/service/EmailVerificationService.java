package com.suin.fincoach.user.model.service;

import java.security.SecureRandom;
import java.sql.Timestamp;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.suin.fincoach.user.model.dao.EmailVerificationDao;
import com.suin.fincoach.user.model.vo.EmailVerification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 이메일 인증코드 발급/검증. PURPOSE는 "SIGNUP" | "RESET".
 * - 코드는 6자리 숫자, bcrypt 해시로만 저장
 * - 재발송 쿨다운(기본 60초), 코드 TTL(기본 5분), 시도 횟수 상한(5회)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EmailVerificationService {

	private final EmailVerificationDao dao;
	private final EmailService emailService;
	private final SqlSessionTemplate sqlSession;
	private final BCryptPasswordEncoder bcrypt;

	@Value("${app.mail.code-ttl-seconds:300}")
	private long ttlSeconds;

	@Value("${app.mail.resend-cooldown-seconds:60}")
	private long cooldownSeconds;

	private static final int MAX_ATTEMPTS = 5;
	private final SecureRandom random = new SecureRandom();

	/** 인증코드 발송. 쿨다운 이내 재요청이면 IllegalStateException. */
	public void sendCode(String rawEmail, String purpose) {
		String email = normalize(rawEmail);

		EmailVerification latest = dao.findLatest(sqlSession, email, purpose);
		if (latest != null && latest.getCreatedAt() != null) {
			long sinceMs = System.currentTimeMillis() - latest.getCreatedAt().getTime();
			if (sinceMs < cooldownSeconds * 1000) {
				throw new IllegalStateException("잠시 후 다시 시도해 주세요.");
			}
		}

		dao.consumeAllFor(sqlSession, email, purpose); // 이전 미사용 코드 무효화

		String code = String.format("%06d", random.nextInt(1_000_000));
		Timestamp expiresAt = new Timestamp(System.currentTimeMillis() + ttlSeconds * 1000);
		dao.insert(sqlSession, email, purpose, bcrypt.encode(code), expiresAt);

		emailService.sendVerificationCode(email, code);
	}

	/** 코드 검증. 성공 시 해당 코드를 소비 처리하고 true. 실패(불일치/만료/시도초과)면 false. */
	public boolean verifyCode(String rawEmail, String purpose, String code) {
		String email = normalize(rawEmail);

		EmailVerification row = dao.findActive(sqlSession, email, purpose);
		if (row == null) {
			return false;
		}

		if (row.getAttempts() >= MAX_ATTEMPTS) {
			dao.markConsumed(sqlSession, row.getId());
			return false;
		}

		if (!bcrypt.matches(code == null ? "" : code.trim(), row.getCodeHash())) {
			dao.incrementAttempts(sqlSession, row.getId());
			return false;
		}

		dao.markConsumed(sqlSession, row.getId());
		return true;
	}

	private String normalize(String email) {
		return email == null ? "" : email.trim().toLowerCase();
	}
}
