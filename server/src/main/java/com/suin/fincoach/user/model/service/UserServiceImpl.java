package com.suin.fincoach.user.model.service;

import java.sql.Timestamp;
import java.util.HashMap;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import com.suin.fincoach.user.model.dao.UserDao;
import com.suin.fincoach.user.model.dto.UserRegisterRequest;
import com.suin.fincoach.user.model.vo.User;
import com.suin.fincoach.util.JwtUtil;

@Service
public class UserServiceImpl implements UserService {
	
	@Autowired
	private UserDao dao;

	@Autowired
	private SqlSessionTemplate sqlSession;
	
	@Autowired
	private JwtUtil jwtUtil; // 토큰 발급용

	@Autowired
	private BCryptPasswordEncoder bcrypt; // 카카오 자동가입용 임시 비밀번호 암호화

	@Value("${kakao.client-id}")
	private String kakaoClientId;

	@Value("${kakao.admin-key}")
	private String kakaoAdminKey;

	@Value("${kakao.redirect-uri}")
	private String kakaoRedirectUri;

	@Value("${kakao.client-secret}")
	private String kakaoClientSecret;

	@Transactional
	@Override // 회원 가입 
	public int insertUser(UserRegisterRequest request) {
		
		User user = request.getUser(); 
		
		String loginType = request.getLoginType();
		
		String providerUserId = request.getProviderUserId();
		
		int result1 = dao.insertUser(sqlSession, user);
		
		int currentUserId = dao.selectUserId(sqlSession);
		
		HashMap<String, Object> accountMap = new HashMap<>();
		
		accountMap.put("loginType", loginType);
		accountMap.put("providerUserId", providerUserId);
		accountMap.put("currentUserId", currentUserId);
		
		int result2 = dao.insertAuthAccount(sqlSession, accountMap); 
		
		int sum = result1 + result2;

		return sum;
		
	}
	
	@Transactional
	@Override // 로그인 메서드, 동시에 마지막 로그인 날짜 SYSDATE를 넣어보기  (트랜잭션 처리를 이용해보자.) 
	public User selectUser(User user) {
		
		int result = 0; // 트랜잭션 처리를 한 후, 결과값 받는 변수 
		
		User loginUser = dao.selectUser(sqlSession, user); // 사용자가 입력한 아이디 및 비밀번호를 데이터 베이스에서 있는지 조회.
		
		//위에 로그인 멤버는 데이터베이스에서 조회만 해온거지 휴면 처리 이런건 전혀 안되어있다. 
		
		if(loginUser!=null) { // DB에서 회원 조회가 됐다면 
			
			if(loginUser.getStatus().equals("N")) { // 탈퇴한 회원은 아래 updateDate를 거칠 필요가 없다. 
				return loginUser;
			}
			
			// 조회가 끝나면 -> 휴면 계정인지 아닌지를 체크 하고 마지막 로그인 날짜까지 갱신  
			
			result = dao.updateDate(sqlSession,loginUser); // 로그인 한 시점을 마지막 로그인 날짜로 바꾸기
			
			//이때 DB는 수정 됐지만 로그인 멤버 객체는 수정이 안됐다. (휴면 판단 여부 및 마지막 로그인 날짜 처리) 
			
			loginUser = dao.selectUser(sqlSession, user); // 갱신 하고나서 로그인 멤버 한번 더 초기화. 
			
			//업데이트 할때 SYSDATE - LAST_LOGIN >= 30 조건 걸어두기
			
			if(result > 0) { // 아이디및 비밀번호랑 일치한 회원 정보가 있고 마지막 로그인 날짜까지 수정 됐다면 로그인 승인. 
				return loginUser; 
			} 
		}
		
		return null; // 이 경우는 loginMember가 null이든 아니든 마지막 로그인 날짜 시점을 처리하지 못하면 실패로 처리.

	}

	@Transactional
	@Override // 로그인 전용 — 이메일로 회원 조회. 조회되면 마지막 로그인 날짜 갱신 + 휴면 판정.
	public User selectUserByEmail(User user) {

		User loginUser = dao.selectUserByEmail(sqlSession, user);

		if (loginUser != null) {

			if (loginUser.getStatus().equals("N")) {
				return loginUser;
			}

			int result = dao.updateDate(sqlSession, loginUser); // 내부 LOGIN_ID 기준이라 그대로 동작

			loginUser = dao.selectUserByEmail(sqlSession, user); // 갱신된 정보 재조회

			if (result > 0) {
				return loginUser;
			}
		}

		return null;

	}


	@Override
	public Map<String, Object> processKakaoLogin(String code, String redirectUri) {

		// 카카오 토큰 받기
	    RestTemplate rt = new RestTemplate();
	    HttpHeaders headers = new HttpHeaders();
	    headers.add("Content-type", "application/x-www-form-urlencoded;charset=utf-8");

	    // 프론트가 인가 요청 때 실제로 쓴 redirect_uri를 그대로 돌려줘야 카카오가 토큰 교환을 승인한다
	    // (둘이 다르면 실패). beta/v3처럼 배포 도메인이 여러 개일 수 있어 서버 고정값 대신 요청값을 우선 사용하고,
	    // 값이 없을 때만(구버전 프론트 등) application.properties의 기본값으로 폴백한다.
	    String effectiveRedirectUri = (redirectUri != null && !redirectUri.isBlank()) ? redirectUri : kakaoRedirectUri;

	    MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
	    params.add("grant_type", "authorization_code");
	    params.add("client_id", kakaoClientId);
	    params.add("redirect_uri", effectiveRedirectUri);
	    params.add("code", code);
	    params.add("client_secret", kakaoClientSecret);

	    HttpEntity<MultiValueMap<String, String>> tokenRequest = new HttpEntity<>(params, headers);
	    ResponseEntity<Map> tokenResponse = rt.exchange("https://kauth.kakao.com/oauth/token", HttpMethod.POST, tokenRequest, Map.class);
	    String accessToken = (String) tokenResponse.getBody().get("access_token");

	    // 2. 사용자 정보 가져오기 (닉네임 + 이메일)
	    headers = new HttpHeaders();
	    headers.add("Authorization", "Bearer " + accessToken);
	    HttpEntity<MultiValueMap<String, String>> profileRequest = new HttpEntity<>(headers);
	    ResponseEntity<Map> profileResponse = rt.exchange("https://kapi.kakao.com/v2/user/me", HttpMethod.POST, profileRequest, Map.class);
	    
	    Map<String, Object> body = profileResponse.getBody();
	    Map<String, Object> kakaoAccount = (Map<String, Object>) body.get("kakao_account");
	    Map<String, Object> profile = (Map<String, Object>) kakaoAccount.get("profile");
	    
	    String email = (String) kakaoAccount.get("email"); // account_email 스코프 미사용이라 보통 null
	    String kakaoNickname = (String) profile.get("nickname");
	    String realName = (String) kakaoAccount.get("name"); // 카카오 "이름"(실명) 동의항목 — 콘솔에서 켜야 값이 옴
	    // 이름(USER_NAME)은 실명 우선, 없으면 카카오 닉네임, 그것도 없으면 "오소리".
	    String displayName = (realName != null && !realName.isBlank()) ? realName
	    		: (kakaoNickname != null && !kakaoNickname.isBlank()) ? kakaoNickname : "오소리";

	    String providerUserId = String.valueOf(body.get("id")); // 고유 토큰 아이디
	    String loginType = "KAKAO"; // 로그인 타입

	    // 3. DB 가입 확인 및 처리 (카카오 고유 ID 기준 — 이메일 동의항목 권한이 없어 email이 null일 수 있음)
	    User user = dao.findLoginIdByProviderUserId(sqlSession, providerUserId); // 회원 조회

	    Map<String, Object> result = new HashMap<>();

	    if (user == null) { // 신규 카카오 회원 — 닉네임 입력 화면 없이 바로 가입 처리한다.
	    		// 식별은 PROVIDER_USER_ID로 하며, 이메일은 못 받아오면 null로 둔다(로그인에 필요 없음).
	    		String generatedLoginId = "kakao_" + providerUserId; // 카카오 고유 ID 기반이라 충돌 없음
	    		String rawPassword = java.util.UUID.randomUUID().toString(); // 카카오로만 로그인하므로 실사용 안 함

	    		User newUser = User.builder()
	    				.loginId(generatedLoginId)
	    				.userName(displayName)
	    				.email(email) // null 가능 (EMAIL 컬럼 nullable)
	    				.password(bcrypt.encode(rawPassword))
	    				.build();

	    		UserRegisterRequest registerRequest = UserRegisterRequest.builder()
	    				.user(newUser)
	    				.loginType("KAKAO")
	    				.providerUserId(providerUserId)
	    				.build();

	    		insertUser(registerRequest); // USERS + AUTH_ACCOUNT 동시 insert

	    		user = dao.findLoginIdByProviderUserId(sqlSession, providerUserId);

	    		String token = jwtUtil.generateToken(user.getLoginId());
	    		user.setPassword(null);
	    		result.put("token", token);
	    		result.put("user", user);
	    		result.put("isNewMember", true); // 프론트 "가입 완료" 안내 토스트용
	    		return result;
	    } else {
	    	
	    		if(user.getLockUntil() != null) { // 카카오로 로그인을 한다 하더라도 잠금 시간이 설정 되어 있는지 확인해야 한다.
	    			boolean canLogin = compareLockUntil(user.getLockUntil(), user.getLoginId());
	    			
	    			if(!canLogin) { // false 일 때만 메시지 띄우기 
	    				result.put("message", "잠금 모드가 해제 되는 시간은 " + user.getLockUntil() + "입니다.");
	    				return result; 
	    			}
	    		}
	    		// providerUserId로 이미 회원을 찾았으므로(=이미 카카오로 연동된 계정) 별도의 재연동 처리는 불필요

	    		// 카카오 쪽 이름/이메일이 가입 이후 바뀌었을 수 있으니 로그인할 때마다 최신값으로 동기화한다.
	    		// 이메일은 새로 받아온 값이 없을 때(동의 철회 등) 기존 값을 지우지 않도록 COALESCE로 보존.
	    		dao.syncKakaoProfile(sqlSession, user.getUserId(), displayName, email);
	    }

	    int rowUpdate = dao.updateDate(sqlSession,user); // 업데이트 된 행이 있는지 판별

	    if(rowUpdate > 0) { // lastLogin 날짜 갱신 됐는가 ?

	    	
	    	user = dao.findLoginIdByProviderUserId(sqlSession, providerUserId); // 업데이트 된 유저 객체 한번 더 호출

	    	// 4. 전용 JWT 발행
		    String token = jwtUtil.generateToken(user.getLoginId());
		    user.setPassword(null);
		    result.put("token", token);
		    result.put("user", user);
		    
	        if("H".equals(((User)result.get("user")).getStatus())) {
        			result.put("message", "휴면 회원 입니다. 프로필 설정 페이지에서 휴면 해제 후, 서비스 이용 가능합니다.");
	        } else if ("N".equals(((User)result.get("user")).getStatus())) {
	        		result.put("message", "탈퇴한 회원입니다."); 
	        }
		   
		    return result; // 날짜가 갱신이 되면 로그인 성공 처리 

	    	
	    }
	    return null; // 날짜가 갱신이 안되면 바로 로그인 실패 처리


	}

	//카카오 연동 해제
	@Override
	@Transactional
	public boolean unlinkKakao(int userId) {
		
		// 먼저 userId로 AUTH_ACCOUNT 테이블과 USERS 테이블을 조인해서 토큰 아이디 값을 갖고온다.
		String providerUserId = dao.getProviderUserId(sqlSession, userId); 
		
		String adminKey = kakaoAdminKey;
		String url = "https://kapi.kakao.com/v1/user/unlink"; // 연결 해제를 하기 위한 링크
		
		RestTemplate rt = new RestTemplate();
		
		//헤더 설정
		HttpHeaders headers = new HttpHeaders();
		headers.add("Authorization", "KakaoAK " + adminKey);
		headers.add("Content-Type", "application/x-www-form-urlencoded;charset=utf-8");
		
		//본문 설정
		MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
		params.add("target_id_type", "user_id");
		params.add("target_id", providerUserId);
		
		HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params,headers);
		
		try {
	        ResponseEntity<Map> response = rt.exchange(url, HttpMethod.POST, request, Map.class);
	        
	        if (response.getStatusCode() == HttpStatus.OK) { // 연동 해제 ok 승인이 떨어지면 
	        	
	        	HashMap<String, Object> authAccountMap = new HashMap<>();
	        	
	        	authAccountMap.put("userId", userId);
	        	authAccountMap.put("loginType", "LOCAL"); 
	            
	        	int result = dao.updateAuthAccount(sqlSession, authAccountMap);
	        	
	        	if(result > 0) {
	        		return true; // 로그인 타입이랑 토큰 번호를 수정하면 정상적으로 바껴서 true. 
	        	} else {
	        		return false; // 위 케이스가 아니면 false. 
	        	}
	        	
	            
	        }
	    } catch (Exception e) {
	        e.printStackTrace();
	    }
	    return false;
		
	}
	
	
	
	@Override // 아이디 중복체크 
	public int idCheck(String loginId) {
		int result = dao.idCheck(sqlSession, loginId);
		
		return result; 
	}
	
	@Override // 이메일 중복체크
	public int emailCheck(String email) {
		
		int result = dao.emailCheck(sqlSession, email);
		
		return result; 
		
	}
	
	@Override // 회원 정보 업데이트
	public int updateUser(User loginUser) {
		int result = dao.updateUser(sqlSession,loginUser);

		return result;
	}

	@Override // 월 예산 + 저축 목표 업데이트
	public int updateBudget(User loginUser) {
		return dao.updateBudget(sqlSession, loginUser);
	}
	
	//회원 상태 N으로 바꾸기 (로그인 불가능 하게), 식별 정보 해제 + 카카오 연동 해제로 재가입 가능하게
	@Transactional
	@Override
	public int deleteUser(User loginUser) {
		int result = dao.deleteUser(sqlSession,loginUser);
		dao.clearAuthProvider(sqlSession, loginUser.getUserId());

		return result;
	}
	
	//비밀번호 변경 메소드 
	@Override
	public int changeUserPwd(User loginUser) {
		int result = dao.changeUserPwd(sqlSession, loginUser); 
			
		return result; 
	}
	
	//loginId를 기반으로 사용자 정보 갖고오는 메소드 
	@Override
	public User selectByLoginId(String loginId) {
		User loginUser = dao.selectByLoginId(sqlSession, loginId);
		
		return loginUser; 
	}
	
	//비밀번호 재설정 1단계 — 이메일로 재설정 가능한(활성 로컬) 계정 조회 (소셜/비활성/없음 시 null)
	@Override
	public User findResettableUserByEmail(String email) {
		if (email == null || email.isBlank()) {
			return null;
		}
		return dao.selectResettableUserByEmail(sqlSession, email.trim());
	}

	//비밀번호 재설정 2단계 — 검증된 USER_ID로만 비밀번호 갱신
	@Override
	public int resetPassword(int userId, String encodedPassword) {
		return dao.resetPassword(sqlSession, userId, encodedPassword);
	}
	
	// 추가 메소드 (로그인 카운트 갱신)
	@Transactional 
	@Override
	public User updateLoginCount(User loginUser) {
		
		int result = dao.updateLoginCount(sqlSession, loginUser);
		
		if(result > 0) { // 이건 일반적으로 로그인 카운트가 업데이트 될 때 
			loginUser = dao.selectUser(sqlSession, loginUser); // 로그인 횟수가 갱신된 객체를 반환 
			
			if(loginUser.getLoginCount()>=5) { // 로그인 실패 횟수가 5회 이상이면 
				
				int result2 = dao.lockAccount(sqlSession, loginUser); // 잠금 처리하기 
				
				if(result2 > 0) { 	// 잠금 처리가 됐다면
					return dao.selectUser(sqlSession, loginUser);
				} else { // 잠금 처리가 안됐다면
					return null; 
				}
				
			}
			
			return loginUser; 
		} else { // 여기서는 로그인 카운트가 업데이트가 안되면 null 반환 
			loginUser = null;
			
			return loginUser; 
		}
		
	}
	
	// 컨트롤러에서 평문이랑 암호화 된 비밀번호랑 일치하지 않을 때 쓰는 메소드 
	@Override
	public boolean compareLockUntil(Timestamp lockUntil, String loginId) {
		
		// 1. 잠금 시간 자체가 없으면 바로 로그인 가능
	    if (lockUntil == null) {
//	        int result = dao.resetLoginLock2(sqlSession, loginId); 
//	        
//	        if(result > 0) { // LOGIN_COUNT를 0으로 리셋 했다면 
//	        	return true; 
//	        } 
//	    	
//	        return false;
	    	
	    	return true; 
	    	
	    }

	    Timestamp now = new Timestamp(System.currentTimeMillis());

	    // 2. 현재 시간이 잠금 해제 시간을 지났다면?
	    if (now.after(lockUntil)) {
	        // 시간이 지났으니 DB의 카운트와 잠금시간을 초기화(null) 합니다.
	      
	        int result = dao.resetLoginLock(sqlSession, loginId); 
	        
	        if(result > 0) { // 시간이 지났고 갱신을 했으면 true를 반환 
	        	return true; 
	        }
	        
	        return false; // 갱신 못하면 false 반환 
	    }

	    // 3. 아직 시간이 안 지났다면
	    return false; // 여전히 잠금 상태
		
	}
	
	//컨트롤러에서 평문이랑 암호화 된 비밀번호가 일치할 때 쓰는 메소드 
	@Override
	public boolean compareLockUntil2(Timestamp lockUntil, String loginId) {
		
		// 1. 잠금 시간 자체가 없으면 바로 로그인 가능
	    if (lockUntil == null) {
	        int result = dao.resetLoginLock2(sqlSession, loginId); 
	        
	        if(result > 0) { // LOGIN_COUNT를 0으로 리셋 했다면 
	        	return true; 
	        } 
	    	
	        return false;
	    	
	    }

	    Timestamp now = new Timestamp(System.currentTimeMillis());

	    // 2. 현재 시간이 잠금 해제 시간을 지났다면?
	    if (now.after(lockUntil)) {
	        // 시간이 지났으니 DB의 카운트와 잠금시간을 초기화(null) 합니다.
	      
	        int result = dao.resetLoginLock(sqlSession, loginId); 
	        
	        if(result > 0) { // 시간이 지났고 갱신을 했으면 true를 반환 
	        	return true; 
	        }
	        
	        return false; // 갱신 못하면 false 반환 
	    }

	    // 3. 아직 시간이 안 지났다면
	    return false; // 여전히 잠금 상태
		
	}
	
	

}