package com.suin.fincoach.user.model.dto;

import com.suin.fincoach.user.model.vo.User;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Builder
@Data
public class UserRegisterRequest {
	
	private User user;
	private String loginType;
    private String providerUserId;
    // 로컬 회원가입 시, /user/email/verify-code 에서 받은 이메일 인증 완료 토큰(JWT). 이메일은 이 토큰에서만 취한다.
    private String emailToken;

}
