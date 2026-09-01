package com.suin.fincoach.user.model.dao;

import java.sql.Timestamp;
import java.util.HashMap;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.user.model.vo.User;

@Repository
public class UserDao {
	
	    //회원 가입 
		public int insertUser(SqlSessionTemplate sqlSession, User user) {
			return sqlSession.insert("userMapper.insertUser", user); 
			
		}
		
		//회원 조회
		public User selectUser(SqlSessionTemplate sqlSession, User user) {
			return sqlSession.selectOne("userMapper.selectUser", user);
		}

		//이메일로 회원 조회 (로그인 전용)
		public User selectUserByEmail(SqlSessionTemplate sqlSession, User user) {
			return sqlSession.selectOne("userMapper.selectUserByEmail", user);
		}


		//이메일 중복체크
		public int emailCheck(SqlSessionTemplate sqlSession, String email) {
			return sqlSession.selectOne("userMapper.emailCheck",email); 
		}
		
		//사용자가 로그인을 시도하려고 할때 사용자 정보가 있으면 마지막 로그인 한 날짜를 업데이트 처리 및 휴면 계정까지 처리하기 
		public int updateDate(SqlSessionTemplate sqlSession, User loginUser) {
			return sqlSession.update("userMapper.updateDate",loginUser); 
		}

		//정보 수정 (휴면 계정이면 status도 바꿔주자. 근데 사실 휴면계정이든 아니든 status Y로 고정 시켜도 문제없다. N은 탈퇴 한사람으로 가정)
		public int updateUser(SqlSessionTemplate sqlSession, User loginUser) {
			return sqlSession.update("userMapper.updateUser",loginUser);
		}

		// 월 예산(B_AMOUNT) + 저축 목표 수정
		public int updateBudget(SqlSessionTemplate sqlSession, User loginUser) {
			return sqlSession.update("userMapper.updateBudget", loginUser);
		}

		// 카카오 로그인할 때마다 이름/이메일을 최신값으로 동기화 (값이 없으면 기존 값 유지)
		public int syncKakaoProfile(SqlSessionTemplate sqlSession, int userId, String userName, String email) {
			Map<String, Object> params = new HashMap<>();
			params.put("userId", userId);
			params.put("userName", userName);
			params.put("email", email);
			return sqlSession.update("userMapper.syncKakaoProfile", params);
		}
		
		//회원 삭제(DB에서 아예 삭제가 아닌 STATUS='N'으로)
		public int deleteUser(SqlSessionTemplate sqlSession, User loginUser) {
			return sqlSession.delete("userMapper.deleteUser", loginUser);
		}

		//탈퇴한 회원의 카카오 연동 끊기(재가입 시 신규 회원으로 인식되도록)
		public int clearAuthProvider(SqlSessionTemplate sqlSession, int userId) {
			return sqlSession.update("userMapper.clearAuthProvider", userId);
		}

		//회원 비밀번호 변경 
		public int changeUserPwd(SqlSessionTemplate sqlSession, User loginUser) {
			return sqlSession.update("userMapper.changeUserPwd", loginUser); 
		}

		//loginId를 바탕으로 사용자 찾기 
		public User selectByLoginId(SqlSessionTemplate sqlSession, String loginId) {
			return sqlSession.selectOne("userMapper.selectByLoginId", loginId); 
		}

		//카카오 providerUserId를 바탕으로 사용자 찾기 (이메일 동의항목 권한이 없어도 동작)
		public User findLoginIdByProviderUserId(SqlSessionTemplate sqlSession, String providerUserId) {
			return sqlSession.selectOne("userMapper.findLoginIdByProviderUserId", providerUserId);
		}

		//비밀번호 재설정 1단계 — 이메일로 재설정 가능한(활성 로컬) 계정 조회 (없으면 null)
		public User selectResettableUserByEmail(SqlSessionTemplate sqlSession, String email) {
			return sqlSession.selectOne("userMapper.selectResettableUserByEmail", email);
		}

		//비밀번호 재설정 2단계 — USER_ID로만 비밀번호 갱신
		public int resetPassword(SqlSessionTemplate sqlSession, int userId, String encodedPassword) {
			Map<String, Object> userMap = new HashMap<>();
			userMap.put("userId", userId);
			userMap.put("newPassword", encodedPassword);
			return sqlSession.update("userMapper.resetPassword", userMap);
		}
		
		//현재 시퀀스 번호 갖고오는 메소드
		public int selectUserId(SqlSessionTemplate sqlSession) {
			
			return sqlSession.selectOne("userMapper.selectUserId");
					
		}

		public int insertAuthAccount(SqlSessionTemplate sqlSession, HashMap<String, Object> accountMap) {
			return sqlSession.insert("userMapper.insertAuthAccount", accountMap); 
		}
		
		//토큰 아이디 갖고오기
		public String getProviderUserId(SqlSessionTemplate sqlSession, int userId) {
			return sqlSession.selectOne("userMapper.getProviderUserId", userId); 
		}

		//연동 해제시 로컬로 전환
		public int updateAuthAccount(SqlSessionTemplate sqlSession, HashMap<String, Object> authAccountMap) {
			return sqlSession.update("userMapper.updateAuthAccount", authAccountMap); 
		}
		
		//기존에 연동했던 사람이 다시 연동하려는 경우
		public int updateAuthAccount2(SqlSessionTemplate sqlSession, Map<String, Object> result) {
			return sqlSession.update("userMapper.updateAuthAccount2", result); 
		}

		//로그인 실패시 로그인 카운트 횟수 늘리기 
		public int updateLoginCount(SqlSessionTemplate sqlSession, User loginUser) {
			return sqlSession.update("userMapper.updateLoginCount", loginUser); 
		}

		// 계정 잠금 처리 
		public int lockAccount(SqlSessionTemplate sqlSession,User loginUser) {
			return sqlSession.update("userMapper.lockAccount", loginUser); 
		}

		// 현재 시간이 잠금 시간보다 이후면 잠금 해제 하는 메소드 
		public int resetLoginLock(SqlSessionTemplate sqlSession, String loginId) {
			return sqlSession.update("userMapper.resetLoginLock", loginId); 
		}

		public int resetLoginLock2(SqlSessionTemplate sqlSession, String loginId) {
			return sqlSession.update("userMapper.resetLoginLock2", loginId);
		}


}
