package com.suin.fincoach.user.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.suin.fincoach.user.model.service.EmailVerificationService;
import com.suin.fincoach.user.model.service.UserService;
import com.suin.fincoach.util.JwtUtil;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 이메일 본인인증. 회원가입(SIGNUP) 시 이메일 소유를 확인한다.
 * 1) POST /user/email/send-code  { email }            → 6자리 코드 메일 발송
 * 2) POST /user/email/verify-code { email, code }      → 성공 시 { emailToken } (회원가입 요청에 첨부)
 *
 * (RESET 용도는 비밀번호 재설정 단계에서 별도 엔드포인트로 연결한다.)
 */
@RestController
@RequestMapping("/user/email")
@RequiredArgsConstructor
@Slf4j
public class EmailVerificationController {

	private static final String PURPOSE_SIGNUP = "SIGNUP";

	private final EmailVerificationService emailVerificationService;
	private final UserService userService;
	private final JwtUtil jwtUtil;

	@PostMapping("/send-code")
	public ResponseEntity<?> sendCode(@RequestBody Map<String, String> body) {
		String email = body.getOrDefault("email", "").trim();

		if (email.isEmpty() || !email.contains("@")) {
			return ResponseEntity.badRequest().body("올바른 이메일을 입력해 주세요.");
		}

		// 회원가입용: 이미 가입된 이메일이면 코드 발송하지 않고 안내
		if (userService.emailCheck(email) > 0) {
			return ResponseEntity.status(HttpStatus.CONFLICT).body("이미 가입된 이메일입니다. 로그인해 주세요.");
		}

		try {
			emailVerificationService.sendCode(email, PURPOSE_SIGNUP);
		} catch (IllegalStateException e) {
			// 쿨다운 또는 메일 발송 실패
			return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(e.getMessage());
		}

		return ResponseEntity.ok("인증코드를 보냈습니다. 메일함을 확인해 주세요.");
	}

	@PostMapping("/verify-code")
	public ResponseEntity<?> verifyCode(@RequestBody Map<String, String> body) {
		String email = body.getOrDefault("email", "").trim();
		String code = body.getOrDefault("code", "").trim();

		if (email.isEmpty() || code.isEmpty()) {
			return ResponseEntity.badRequest().body("이메일과 인증코드를 입력해 주세요.");
		}

		boolean ok = emailVerificationService.verifyCode(email, PURPOSE_SIGNUP, code);
		if (!ok) {
			return ResponseEntity.badRequest().body("인증코드가 올바르지 않거나 만료되었습니다.");
		}

		String emailToken = jwtUtil.generateEmailVerifiedToken(email.toLowerCase(), PURPOSE_SIGNUP);

		Map<String, Object> res = new HashMap<>();
		res.put("emailToken", emailToken);
		res.put("message", "이메일 인증이 완료되었습니다.");
		return ResponseEntity.ok(res);
	}
}
