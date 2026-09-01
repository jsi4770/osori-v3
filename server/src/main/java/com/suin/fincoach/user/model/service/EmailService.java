package com.suin.fincoach.user.model.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 이메일 발송기. Gmail SMTP(spring.mail.*)를 쓰며,
 * - app.mail.enabled=false거나 자격증명이 없으면 실제 발송을 건너뛰고 인증코드를 로그로만 남긴다(로컬 개발용).
 * - JavaMailSender 빈이 없어도(자동설정 실패 등) NPE 없이 no-op으로 동작한다.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EmailService {

	private final ObjectProvider<JavaMailSender> mailSenderProvider;

	@Value("${app.mail.enabled:false}")
	private boolean enabled;

	@Value("${app.mail.from:no-reply@osori.app}")
	private String from;

	/** 6자리 인증코드 메일 발송. 비활성 상태면 코드를 로그로만 출력하고 조용히 반환한다. */
	public void sendVerificationCode(String toEmail, String code) {
		String subject = "[오소리] 이메일 인증코드";
		String body = "오소리 이메일 인증코드는 " + code + " 입니다.\n"
				+ "5분 안에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.";

		JavaMailSender sender = mailSenderProvider.getIfAvailable();

		if (!enabled || sender == null) {
			// 개발/미설정 환경: 실제 발송 대신 코드만 로그로 남긴다(운영에서 MAIL_ENABLED=true면 이 경로로 안 옴).
			log.warn("[email] 발송 비활성 — to={} code={} (MAIL_ENABLED로 켜세요)", toEmail, code);
			return;
		}

		try {
			SimpleMailMessage msg = new SimpleMailMessage();
			msg.setFrom(from);
			msg.setTo(toEmail);
			msg.setSubject(subject);
			msg.setText(body);
			sender.send(msg);
			log.info("[email] 인증코드 발송 완료 to={}", toEmail);
		} catch (Exception e) {
			log.error("[email] 인증코드 발송 실패 to={}", toEmail, e);
			throw new IllegalStateException("인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
		}
	}
}
