package com.suin.fincoach.user.model.service;

import java.sql.Timestamp;
import java.util.Map;

import com.suin.fincoach.user.model.dto.UserRegisterRequest;
import com.suin.fincoach.user.model.vo.User;

public interface UserService {
	
	int insertUser(UserRegisterRequest request); // 회원 가입 메소드 
	int idCheck(String inputId); // 아이디 중복 체크 메소드 
	int nickNameCheck(String nickName); // 닉네임 중복 체크 메소드
	int emailCheck(String email); // 이메일 중복 체크 메소드
	User selectUser(User user); // 회원 조회, 마지막 로그인 날짜 갱신 및 휴면 계정 처리 메소드 
	int updateUser(User loginUser); // 정보 수정
	int updateBudget(User loginUser); // 월 예산 + 저축 목표 수정
	int deleteUser(User loginUser); // 회원 탈퇴 메소드
	int changeUserPwd(User loginUser); // 비밀번호 변경 메소드
	User selectByLoginId(String loginId); // 아이디로 회원 정보 조회하는 메소드 
	User findLoginIdByEmail(String email);
	int resetPassword(Map<String, String> userMap); 
	
	// 카카오 로그인 처리 메소드 , 기존에 연동 했던 사람이 연동 해제 후 다시 연동 하려고 할때 연동 가능한 메소드
	Map<String, Object> processKakaoLogin(String code);
	
	//카카오 연동 해제 메소드 
	boolean unlinkKakao(int userId);
	
	User updateLoginCount(User loginUser); 
	
	// 아이디는 잘 입력했는데 비밀번호를 잘못 입력했을때 작동하는 메소드
	boolean compareLockUntil(Timestamp lockUntil, String loginId);
	
	// 아이디,비밀번호 둘 다 잘 입력했을때 작동하는 메소드
	boolean compareLockUntil2(Timestamp lockUntil, String loginId); 
	
	
	
}