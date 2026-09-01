package com.suin.fincoach.user.model.vo;

import java.sql.Timestamp;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 이메일 본인인증 코드 1건. PURPOSE로 회원가입(SIGNUP)/비밀번호 재설정(RESET)을 구분한다.
 * CODE_HASH는 6자리 코드의 bcrypt 해시이며 평문은 저장하지 않는다.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailVerification {

	private int id;
	private String email;
	private String purpose;   // SIGNUP | RESET
	private String codeHash;
	private Timestamp expiresAt;
	private String consumed;  // Y | N
	private int attempts;
	private Timestamp createdAt;
}
