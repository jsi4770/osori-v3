package com.suin.fincoach.user.model.service;

import java.sql.Timestamp;
import java.util.Map;

import com.suin.fincoach.user.model.dto.UserRegisterRequest;
import com.suin.fincoach.user.model.vo.User;

public interface UserService {
	
	int insertUser(UserRegisterRequest request); // 회원 가입 메소드
	int idCheck(String inputId); // 아이디 중복 체크 메소드
	int emailCheck(String email); // 이메일 중복 체크 메소드
	User selectUser(User user); // 회원 조회, 마지막 로그인 날짜 갱신 및 휴면 계정 처리 메소드
	User selectUserByEmail(User user); // 이메일로 회원 조회 (로그인 전용)
	int updateUser(User loginUser); // 정보 수정
	int updateBudget(User loginUser); // 월 예산 + 저축 목표 수정
	int deleteUser(User loginUser); // 회원 탈퇴 메소드
	int changeUserPwd(User loginUser); // 비밀번호 변경 메소드
	User selectByLoginId(String loginId); // 아이디로 회원 정보 조회하는 메소드

	// 비밀번호 재설정 1단계 — 이메일로 재설정 가능한(활성 로컬) 계정을 찾는다(소셜 계정 제외). 없으면 null.
	User findResettableUserByEmail(String email);

	// 비밀번호 재설정 2단계 — 재설정 토큰에서 검증된 USER_ID로만 비밀번호를 갱신한다.
	int resetPassword(int userId, String encodedPassword);
	
	// 카카오 로그인 처리 메소드 , 기존에 연동 했던 사람이 연동 해제 후 다시 연동 하려고 할때 연동 가능한 메소드
	// redirectUri: 프론트가 인가 요청 때 실제로 쓴 콜백 URL(배포 도메인이 여러 개일 수 있어 필요) — 없으면 서버 기본값 사용
	Map<String, Object> processKakaoLogin(String code, String redirectUri);

	//카카오 연동 해제 메소드
	boolean unlinkKakao(int userId);
	
	User updateLoginCount(User loginUser); 
	
	// 아이디는 잘 입력했는데 비밀번호를 잘못 입력했을때 작동하는 메소드
	boolean compareLockUntil(Timestamp lockUntil, String loginId);
	
	// 아이디,비밀번호 둘 다 잘 입력했을때 작동하는 메소드
	boolean compareLockUntil2(Timestamp lockUntil, String loginId); 
	
	
	
}