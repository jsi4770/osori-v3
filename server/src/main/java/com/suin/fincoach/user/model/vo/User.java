package com.suin.fincoach.user.model.vo;

import java.sql.Date;
import java.sql.Timestamp;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data

public class User {
	
	private int userId; //회원 내부 식별자 (PK, 시퀀스)
	private String loginId; // 내부 불변 식별자 (local_* / kakao_*, 중복 불가)
	private String userName; // 회원 이름 (표시 이름)
	private String email; // 이메일 — 로그인 식별자 (중복 불가)
	private String password; // 비밀번호
	private String status; // 회원 상태 (활성,비활성,휴면)
	private Date lastLogin; // 마지막 로그인 시점
	private Date createdAt; // 가입일
	private int bAmount;	//	B_AMOUNT	NUMBER	Yes		12	예산 (월 예산으로 사용)
	private int resetDate;	//	RESET_DATE	NUMBER	Yes		13	예산리셋날짜
	private int savingsGoalAmount; // 저축 목표 금액
	private Date savingsGoalDate; // 저축 목표 날짜
	private int savingsCurrentAmount; // 현재 저축액 (사용자가 직접 입력/갱신 + 자동 적립분 누적)
	private String savingsAutoFill; // 'Y'면 매달 지난달 남은 예산을 저축액에 자동 적립
	private String withdrawReason; // 탈퇴 사유 (탈퇴 시에만 세팅)
	private int loginCount; // (추가) 로그인 횟수
	private Timestamp lockUntil; // (추가) (잠금 시간 언제까지인지) 
	
	
	//어떤 로그인 타입인지 알려고 하기 위함 
	private String loginType; 

}
