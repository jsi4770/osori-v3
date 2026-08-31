package com.suin.fincoach.config;

import java.security.Security;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.PushService;

/**
 * 웹푸시(VAPID) 발송기 빈. VAPID 키는 환경변수(WEBPUSH_VAPID_*)로 주입하며,
 * 키가 비었거나 CHANGE_ME 상태면 키 없는 PushService를 만들어 둔다
 * (PushNotificationService가 webpush.enabled=false일 때 아예 호출하지 않으므로 안전).
 *
 * 키 생성: `npx web-push generate-vapid-keys`
 */
@Configuration
@Slf4j
public class WebPushConfig {

	@Value("${webpush.vapid.public-key:}")
	private String publicKey;

	@Value("${webpush.vapid.private-key:}")
	private String privateKey;

	@Value("${webpush.vapid.subject:mailto:admin@osori.app}")
	private String subject;

	@Bean
	public PushService webPushService() {
		if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
			Security.addProvider(new BouncyCastleProvider());
		}

		PushService pushService = new PushService();
		if (!isConfigured()) {
			log.warn("[webpush] VAPID 키가 설정되지 않았습니다. 푸시 발송은 비활성 상태로 동작합니다.");
			return pushService;
		}

		try {
			pushService.setPublicKey(publicKey.trim());
			pushService.setPrivateKey(privateKey.trim());
			pushService.setSubject(subject.trim());
			log.info("[webpush] VAPID 키 로드 완료 (subject={})", subject);
		} catch (Exception e) {
			log.error("[webpush] VAPID 키 로드 실패 — 푸시 발송 비활성", e);
		}
		return pushService;
	}

	private boolean isConfigured() {
		return isPresent(publicKey) && isPresent(privateKey);
	}

	private boolean isPresent(String v) {
		if (v == null) {
			return false;
		}
		String t = v.trim();
		return !t.isEmpty() && !t.startsWith("CHANGE") && !t.startsWith("REPLACE");
	}
}
