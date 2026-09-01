package com.suin.fincoach.user.model.service;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
	// application.properties는 ISO-8859-1로 읽혀 한글 기본값이 깨지므로, 발신자 이름 기본값은 여기(UTF-8 소스)에 둔다.
	private static final String DEFAULT_FROM_NAME = "오소리";

	private final RestTemplate rest = new RestTemplate();

	@Value("${app.mail.enabled:false}")
	private boolean enabled;

	@Value("${app.mail.from:no-reply@osori.app}")
	private String from;

	@Value("${app.mail.from-name:}")
	private String fromName;

	@Value("${app.mail.reply-to:}")
	private String replyTo;

	@Value("${brevo.api-key:}")
	private String brevoApiKey;

	/** 6자리 인증코드 메일 발송. 비활성 상태면 코드를 로그로만 출력하고 조용히 반환한다. */
	public void sendVerificationCode(String toEmail, String code) {
		String subject = "[오소리] 이메일 인증코드 " + code;
		String textContent = "오소리 이메일 인증코드는 " + code + " 입니다.\n"
				+ "5분 안에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.";

		if (!enabled || !isConfigured()) {
			// 개발/미설정 환경: 실제 발송 대신 코드만 로그로 남긴다.
			log.warn("[email] 발송 비활성 — to={} code={} (MAIL_ENABLED / BREVO_API_KEY 설정 필요)", toEmail, code);
			return;
		}

		String senderName = (fromName == null || fromName.isBlank()) ? DEFAULT_FROM_NAME : fromName;

		// 순서 유지를 위해 LinkedHashMap 사용 (직렬화는 Jackson이 UTF-8로 처리)
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("sender", Map.of("email", from, "name", senderName));
		body.put("to", List.of(Map.of("email", toEmail)));
		body.put("subject", subject);
		body.put("textContent", textContent);
		body.put("htmlContent", buildHtml(code));
		if (replyTo != null && !replyTo.isBlank()) {
			body.put("replyTo", Map.of("email", replyTo));
		}

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(new MediaType(MediaType.APPLICATION_JSON, StandardCharsets.UTF_8));
		headers.setAccept(List.of(MediaType.APPLICATION_JSON));
		headers.set("api-key", brevoApiKey);

		try {
			ResponseEntity<String> res = rest.postForEntity(BREVO_SEND_URL, new HttpEntity<>(body, headers), String.class);
			log.info("[email] 인증코드 발송 완료 to={} status={} resp={}", toEmail, res.getStatusCode(), res.getBody());
		} catch (Exception e) {
			log.error("[email] 인증코드 발송 실패 to={} : {}", toEmail, e.getMessage());
			throw new IllegalStateException("인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
		}
	}

	private boolean isConfigured() {
		String k = brevoApiKey == null ? "" : brevoApiKey.trim();
		return !k.isEmpty() && !k.startsWith("CHANGE") && !k.startsWith("REPLACE");
	}

	// 인증코드 메일 HTML. 이메일 클라이언트 호환을 위해 모든 스타일은 인라인, 레이아웃은 table 기반.
	// 로고는 이미지 대신 파란색 "OSORI" 워드마크(텍스트) — 이미지 차단/깨짐 없이 어디서나 렌더된다.
	private String buildHtml(String code) {
		return """
				<!DOCTYPE html>
				<html lang="ko">
				<body style="margin:0;padding:0;background-color:#f4f6fb;">
				  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6fb;padding:32px 12px;">
				    <tr><td align="center">
				      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background-color:#ffffff;border:1px solid #e6e9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
				        <tr><td style="padding:28px 32px 10px 32px;">
				          <span style="font-size:22px;font-weight:800;letter-spacing:2px;color:#0066ff;">OSORI</span>
				        </td></tr>
				        <tr><td style="padding:6px 32px 0 32px;">
				          <div style="font-size:18px;font-weight:700;color:#1a1a2e;">이메일 인증코드</div>
				          <p style="margin:6px 0 0 0;font-size:14px;line-height:1.6;color:#5b6472;">아래 6자리 코드를 입력해 이메일 인증을 완료해 주세요.</p>
				        </td></tr>
				        <tr><td style="padding:20px 32px;">
				          <div style="background-color:#eaf1ff;border:1px solid #cfe0ff;border-radius:12px;padding:18px 0;text-align:center;">
				            <span style="font-size:32px;font-weight:800;letter-spacing:10px;color:#0066ff;font-family:'SF Mono',Menlo,Consolas,monospace;">{{CODE}}</span>
				          </div>
				        </td></tr>
				        <tr><td style="padding:0 32px 4px 32px;">
				          <p style="margin:0;font-size:13px;line-height:1.6;color:#8a929e;">이 코드는 <b style="color:#5b6472;">5분간</b> 유효합니다.<br>본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
				        </td></tr>
				        <tr><td style="padding:20px 32px 28px 32px;border-top:1px solid #eef1f6;">
				          <p style="margin:0;font-size:12px;line-height:1.5;color:#aab0bb;">이 메일은 OSORI 가계부 회원가입 · 비밀번호 재설정 과정에서 발송되었습니다.</p>
				        </td></tr>
				      </table>
				    </td></tr>
				  </table>
				</body>
				</html>
				""".replace("{{CODE}}", code);
	}
}
