package com.suin.fincoach.user.model.service;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import lombok.extern.slf4j.Slf4j;

/**
 * 이메일 발송기. Brevo(HTTP API)로 보낸다 — Railway가 컨테이너의 아웃바운드 SMTP(25/465/587)를
 * 막기 때문에 SMTP는 쓸 수 없고, HTTPS(443) API를 쓴다.
 * - app.mail.enabled=false거나 BREVO_API_KEY가 없으면 실제 발송을 건너뛰고 인증코드를 로그로만 남긴다(로컬 개발용).
 */
@Service
@Slf4j
public class EmailService {

	private static final String BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

	private final RestTemplate rest = new RestTemplate();

	@Value("${app.mail.enabled:false}")
	private boolean enabled;

	@Value("${app.mail.from:no-reply@osori.app}")
	private String from;

	@Value("${app.mail.from-name:오소리}")
	private String fromName;

	@Value("${brevo.api-key:}")
	private String brevoApiKey;

	/** 6자리 인증코드 메일 발송. 비활성 상태면 코드를 로그로만 출력하고 조용히 반환한다. */
	public void sendVerificationCode(String toEmail, String code) {
		String subject = "[오소리] 이메일 인증코드";
		String textContent = "오소리 이메일 인증코드는 " + code + " 입니다.\n"
				+ "5분 안에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.";

		if (!enabled || !isConfigured()) {
			// 개발/미설정 환경: 실제 발송 대신 코드만 로그로 남긴다.
			log.warn("[email] 발송 비활성 — to={} code={} (MAIL_ENABLED / BREVO_API_KEY 설정 필요)", toEmail, code);
			return;
		}

		Map<String, Object> body = Map.of(
				"sender", Map.of("email", from, "name", fromName),
				"to", List.of(Map.of("email", toEmail)),
				"subject", subject,
				"textContent", textContent);

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.setAccept(List.of(MediaType.APPLICATION_JSON));
		headers.set("api-key", brevoApiKey);

		try {
			rest.postForEntity(BREVO_SEND_URL, new HttpEntity<>(body, headers), String.class);
			log.info("[email] 인증코드 발송 완료 to={}", toEmail);
		} catch (Exception e) {
			log.error("[email] 인증코드 발송 실패 to={} : {}", toEmail, e.getMessage());
			throw new IllegalStateException("인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
		}
	}

	private boolean isConfigured() {
		String k = brevoApiKey == null ? "" : brevoApiKey.trim();
		return !k.isEmpty() && !k.startsWith("CHANGE") && !k.startsWith("REPLACE");
	}
}
