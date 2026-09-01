package com.suin.fincoach.user.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


import com.suin.fincoach.FincoachApplication;
import com.suin.fincoach.user.model.dto.UserRegisterRequest;
import com.suin.fincoach.user.model.service.EmailVerificationService;
import com.suin.fincoach.user.model.service.UserService;
import com.suin.fincoach.user.model.vo.User;
import com.suin.fincoach.util.JwtUtil;
import com.suin.fincoach.util.SimpleRateLimiter;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
@RequestMapping("/user")
public class UserController {

	private final FincoachApplication fincoachApplication;

	@Autowired
	private UserService service; // 자동으로 빈 주입.

	@Autowired
	private BCryptPasswordEncoder bcrypt; // 암호화하는 빈 주입.

	@Autowired
	private JwtUtil jwtUtil;

	@Autowired
	private EmailVerificationService emailVerificationService;

	@Autowired
	private SimpleRateLimiter rateLimiter;

	UserController(FincoachApplication fincoachApplication) {
		this.fincoachApplication = fincoachApplication;
	} // 토큰 빈 주입

	// 리뷰어 데모용 게스트 계정 아이디 — 미리 목업 데이터를 채워둔 고정 계정으로, 비밀번호 검증 없이 즉시 로그인시킨다.
	private static final String GUEST_LOGIN_ID = "osori100";

	// 게스트 로그인: 온보딩 마지막 화면의 "게스트로 바로 로그인하기" 버튼에서 호출
	@PostMapping("/guest-login")
	public ResponseEntity<?> guestLogin() {

		HashMap<String, Object> map = new HashMap<>();

		User guestUser = service.selectByLoginId(GUEST_LOGIN_ID);

		if (guestUser == null) {
			map.put("message", "게스트 계정을 찾을 수 없습니다.");
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(map);
		}

		String token = jwtUtil.generateToken(guestUser.getLoginId());

		guestUser.setPassword(null);

		map.put("token", token);
		map.put("user", guestUser);

		return ResponseEntity.ok(map);
	}

	// 로그인 처리 및 휴면 판단 메소드
	@PostMapping("/login")
	public ResponseEntity<?> loginMember(@RequestBody User user) {

		HashMap<String, Object> map = new HashMap<>();

		// 이메일로 사용자 조회 (해시 password까지 가져오기) — 이메일 + 비밀번호로 로그인
		User loginUser = service.selectUserByEmail(user);

		if (loginUser != null && bcrypt.matches(user.getPassword(), loginUser.getPassword())) { // 평문과 암호화된 비밀번호 비교, 로그인 유저가 실제로 존재하는 값인지도 보기

			// status 상태값을 비교하기 전에 만약에 LOCK_UNTIL이 있다면?
			boolean canLogin = service.compareLockUntil2(loginUser.getLockUntil(), loginUser.getLoginId());
			
			if(!canLogin) { // false 일 때만 메시지 띄우기 
				map.put("message", "보안을 위해 계정이 일시적으로 잠겨 있습니다.\n해제 예정 시간 : " + loginUser.getLockUntil());
				return ResponseEntity.status(HttpStatus.FORBIDDEN).body(map); // [수정] OK가 아닌 FORBIDDEN 권장
			}
			
			
			if ("Y".equals(loginUser.getStatus())) {

				String token = jwtUtil.generateToken(loginUser.getLoginId()); // 아이디를 기반으로 토큰 가져오기

				loginUser.setPassword(null); // 암호화 된 비밀번호이므로 null 처리

				map.put("token", token); // 옮기려는 토큰 맵에 담기
				map.put("user", loginUser);

				return ResponseEntity.ok(map);

			} else if ("H".equals(loginUser.getStatus())) {

				// 마이페이지 보내는 처리는 프론트에서
				String token = jwtUtil.generateToken(loginUser.getLoginId());

				loginUser.setPassword(null);

				map.put("token", token);
				map.put("user", loginUser);
				map.put("message", "휴면 회원 상태인 계정입니다.\n프로필 설정 페이지에서 휴면 해제 후, 서비스 이용 가능합니다.");

				return ResponseEntity.ok(map);

			} else if ("N".equals(loginUser.getStatus())) {

				map.put("message", "탈퇴 처리된 계정입니다. 고객 센터에 문의해주세요.");
				return ResponseEntity.status(HttpStatus.FORBIDDEN).body(map);
			}

		} else { // 원래는 else에 code,message만 담는 구문이 있었는데 조건을 세분화 함. 
			
			if(loginUser != null) { // 아이디는 잘 입력 했는데 비밀번호는 틀린 경우 
				
				service.compareLockUntil(loginUser.getLockUntil(), loginUser.getLoginId()); // 비교를 한 다음에 갱신 하기
				
				loginUser = service.selectByLoginId(loginUser.getLoginId()); // 갱신한 데이터 갖고오기 
				
				if(loginUser.getLoginCount() < 5) { // 5회 미만일때 갱신 해줘야 하는 구문 
					loginUser = service.updateLoginCount(loginUser); // 로그인 카운트가 갱신된 이후에 loginUser를 갖고오기
				} // 5회 이상이면 그냥 loginUser 갖고오면 된다. 
	
				if(loginUser == null) { // 로그인 카운트 갱신이 실패했다면 (여기서는 로그인 횟수가 갱신되지 않은 loginUser) 
					map.put("message", "로그인 처리중 오류가 발생했습니다. 잠시 후에 로그인 해주세요.");
					
					return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(map); 
				}
				
				if(loginUser.getLoginCount() < 5) { // 로그인 시도 횟수가 5회 미만이면 
					
					map.put("message", "로그인 실패했습니다. \n" + "로그인 실패 횟수 : " + loginUser.getLoginCount() + " / " + "5 \n" 
							+"5회 실패 시 10분동안 계정 잠금 처리됩니다.");
					
				} else if(loginUser.getLoginCount() >= 5) { // 로그인 시도 횟수가 5회 이상이면 
					
					map.put("message", "로그인 5회 오류로 회원님의 계정이 10분동안 잠금 처리됩니다.\n10분 후에 다시 로그인 해주세요. \n"
							+ "잠금 해제 시간 : " + loginUser.getLockUntil());
					
				}
												
			} else { // 이건 회원 정보가 아예 없을 경우 뭐가 틀렸는지 구분하지 않게 하기 위함 (보안) 혹은 비회원 
				
				map.put("code", "LOGIN_FAIL");
				map.put("message", "이메일과 비밀번호를 다시 입력해주세요.");
				
			}

		} 

		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(map); // 비회원일때 처리

	}

	//회원 가입 — 식별자는 이메일. 이메일은 반드시 인증 완료 토큰(emailToken)에서만 취하고,
	// LOGIN_ID는 프론트가 안 보내고 서버가 내부 불변 키로 생성한다. NICKNAME은 더 이상 받지 않는다.
	@PostMapping("/register")
	public ResponseEntity<?> insertUser(@RequestBody UserRegisterRequest request) {

		User user = request.getUser();

		// 1) 이메일 인증 토큰 검증 → 이메일은 여기서만 확정 (클라이언트가 보낸 값 무시)
		String verifiedEmail = jwtUtil.parseEmailVerifiedToken(request.getEmailToken(), "SIGNUP");
		if (verifiedEmail == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body("이메일 인증이 만료되었거나 유효하지 않습니다. 이메일 인증을 다시 진행해 주세요.");
		}

		// 2) 필수값 검증
		if (user == null || user.getPassword() == null || user.getPassword().trim().length() < 8) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("비밀번호는 8자 이상으로 입력해 주세요.");
		}
		if (user.getUserName() == null || user.getUserName().trim().isEmpty()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("이름을 입력해 주세요.");
		}

		// 3) 인증코드 확인 ~ 가입 요청 사이에 이미 가입됐는지 재확인
		if (service.emailCheck(verifiedEmail) > 0) {
			return ResponseEntity.status(HttpStatus.CONFLICT).body("이미 가입된 이메일입니다. 로그인해 주세요.");
		}

		user.setEmail(verifiedEmail);
		user.setLoginId("local_" + java.util.UUID.randomUUID().toString().replace("-", ""));
		user.setPassword(bcrypt.encode(user.getPassword().trim()));

		int result = service.insertUser(request); // 회원 가입 처리 (USERS + AUTH_ACCOUNT)

		if (result >= 2) {
			return ResponseEntity.ok("회원 가입에 성공했습니다. 로그인을 해보세요.");
		} else {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("회원가입에 실패했습니다.");
		}

	}

	// 로그아웃
	@PostMapping("/logout")
	public ResponseEntity<?> logout() {
		return ResponseEntity.ok("로그아웃 되었습니다.");
	}

	// 정보 수정 메소드
	// 월 예산(기존 B_AMOUNT 컬럼 재사용) + 저축 목표(금액/날짜/현재 저축액) 저장.
	// 프론트는 항상 전체 값을 함께 보내야 한다 — 일부만 보내면 나머지가 0/null로 덮어써진다.
	@PatchMapping("/budget")
	public ResponseEntity<?> updateBudget(@RequestBody User loginUser) {

		int result = service.updateBudget(loginUser);

		if (result <= 0) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "저장에 실패했습니다."));
		}

		User updated = service.selectByLoginId(loginUser.getLoginId());
		updated.setPassword(null);

		return ResponseEntity.ok(Map.of("user", updated, "message", "저장했습니다."));
	}

	@PatchMapping("/update")
	public ResponseEntity<?> updateUser(@ModelAttribute User loginUser) {

		HashMap<String, Object> res = new HashMap<>();

		int result = service.updateUser(loginUser);

		if (result > 0) {

			if (loginUser.getStatus().equals("H")) {

				loginUser = service.selectUser(loginUser); // 이렇게 안하면 DB만 업데이트 된다.

				loginUser.setPassword(null); // 토큰에 비밀번호 안 남기게 하기

				res.put("user", loginUser);
				res.put("message", "휴면 상태가 해제 됐습니다.");

				return ResponseEntity.ok(res);
			}

			loginUser = service.selectUser(loginUser);

			loginUser.setPassword(null); // 토큰에 비밀번호 안 남기게 하기

			res.put("user", loginUser);
			res.put("message", "정보를 수정했습니다.");

			return ResponseEntity.ok(res);

		} else {

			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("정보 수정 실패했습니다.");
		}

	}

	// 회원 탈퇴 메소드
	// 회원 탈퇴: 비밀번호 재확인 대신 탈퇴 사유 선택으로 대체(카카오 가입 계정은 비밀번호를 모르므로도 필요했던 변경).
	// 신원 확인은 이미 로그인된 상태의 JWT로 충분하다고 보고 별도 비밀번호 확인은 하지 않는다.
	@DeleteMapping("/delete")
	public ResponseEntity<?> deleteUser(@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestBody Map<String, String> body) {

		HashMap<String, String> res = new HashMap<>();

		String reason = body.get("reason");

		String token = authorization.substring("Bearer ".length()).trim();

		if (!jwtUtil.validateToken(token)) { // 토큰이 유효하지 않으면

			res.put("message", "토큰 시간이 만료 되어 유효하지 않은 토큰입니다. 다시 로그인 해주세요.");

			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(res);

		}

		String loginId = jwtUtil.getloginIdFromToken(token); // 토큰에서 아이디를 갖고 오기

		User loginUser = service.selectByLoginId(loginId); // 로그인 아이디를 바탕으로 유저 정보 갖고 오기
		loginUser.setWithdrawReason(reason);

		int result = service.deleteUser(loginUser);

		if (result > 0) {

			res.put("message", "회원 탈퇴 처리했습니다.");

			return ResponseEntity.ok(res);

		} else {

			res.put("message", "회원 탈퇴 처리 중 서버 오류가 발생했습니다.");

			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(res);
		}

	}

	// 비밀번호 변경 메소드
	@PatchMapping("/updatePassword")
	public ResponseEntity<?> changeUserPwd(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestBody Map<String, String> passwordMap) {

		HashMap<String, String> res = new HashMap<>();

		String currentPassword = passwordMap.get("currentPassword"); // 프론트에서 현재 비밀번호 갖고 오기

		String newPassword = passwordMap.get("newPassword"); // 프론트에서 새 비밀번호 갖고 오기

		String token = authorization.substring("Bearer ".length()).trim();

		String loginId = jwtUtil.getloginIdFromToken(token);

		User loginUser = service.selectByLoginId(loginId); // 아이디와 비밀번호를 갖고와서 아이디에 맞는 회원 비밀번호를 바꿀 수 있다.

		if (bcrypt.matches(currentPassword, loginUser.getPassword())) {

			loginUser.setPassword(bcrypt.encode(newPassword)); // 암호화 된 비밀번호를 기존 유저의 비밀번호에다가 세팅.

			int result = service.changeUserPwd(loginUser);

			if (result > 0) {
				return ResponseEntity.ok("비밀번호가 수정됐습니다.");
			} else {
				return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("서버에 문제가 있어서 비밀번호를 변경하지 못했습니다.");
			}

		} else {

			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("현재 비밀번호를 잘못 입력하셨습니다.");

		}

	}

	// 비밀번호 재설정 1단계 — 이메일로 인증코드 발송.
	// 계정 존재 여부는 응답으로 드러내지 않는다(코드는 해당 이메일로만 감). 소셜/비활성 계정은 대상 아님.
	@PostMapping("/password/send-code")
	public ResponseEntity<?> sendPasswordResetCode(@RequestBody Map<String, String> body, HttpServletRequest request) {

		String email = body.getOrDefault("email", "").trim();
		if (!email.contains("@")) {
			return ResponseEntity.badRequest().body("올바른 이메일을 입력해 주세요.");
		}

		if (!rateLimiter.allow("reset-code:" + SimpleRateLimiter.clientIp(request), 10, 3_600_000L)) {
			return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
		}

		User target = service.findResettableUserByEmail(email);
		if (target != null) {
			try {
				emailVerificationService.sendCode(email, "RESET");
			} catch (IllegalStateException e) {
				return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(e.getMessage());
			}
		}

		return ResponseEntity.ok("가입된 계정이라면 인증코드를 보냈습니다. 메일함을 확인해 주세요.");
	}

	// 비밀번호 재설정 2단계 — 인증코드 확인 → USER_ID에 묶인 10분짜리 재설정 토큰 발급.
	@PostMapping("/password/verify-code")
	public ResponseEntity<?> verifyPasswordResetCode(@RequestBody Map<String, String> body) {

		String email = body.getOrDefault("email", "").trim();
		String code = body.getOrDefault("code", "").trim();
		if (email.isEmpty() || code.isEmpty()) {
			return ResponseEntity.badRequest().body("이메일과 인증코드를 입력해 주세요.");
		}

		boolean ok = emailVerificationService.verifyCode(email, "RESET", code);
		if (!ok) {
			return ResponseEntity.badRequest().body("인증코드가 올바르지 않거나 만료되었습니다.");
		}

		User target = service.findResettableUserByEmail(email);
		if (target == null) {
			return ResponseEntity.badRequest().body("재설정할 수 있는 계정이 아닙니다.");
		}

		String resetToken = jwtUtil.generatePasswordResetToken(target.getUserId());

		Map<String, Object> res = new HashMap<>();
		res.put("resetToken", resetToken);
		res.put("message", "본인 확인이 완료되었습니다. 새 비밀번호를 설정해 주세요.");
		return ResponseEntity.ok(res);
	}

	// 비밀번호 재설정 2단계 — 1단계에서 받은 재설정 토큰 + 새 비밀번호만 받는다.
	// 갱신 대상은 토큰에서 검증한 USER_ID로 고정되며, 클라이언트가 넘긴 닉네임 등은 신뢰하지 않는다.
	@PatchMapping("/resetPassword")
	public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {

		String resetToken = body.get("resetToken");
		String newPassword = body.get("newPassword");

		int userId = (resetToken == null) ? -1 : jwtUtil.parsePasswordResetToken(resetToken);
		if (userId <= 0) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body("재설정 링크가 만료되었거나 유효하지 않습니다. 처음부터 다시 시도해 주세요.");
		}

		if (newPassword == null || newPassword.trim().length() < 8) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("비밀번호는 8자 이상으로 입력해 주세요.");
		}

		int result = service.resetPassword(userId, bcrypt.encode(newPassword.trim()));

		if (result > 0) {
			return ResponseEntity.ok("비밀번호가 재설정되었습니다.");
		} else {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("서버에 문제가 생겨서 비밀번호 수정을 실패 했습니다.");
		}

	}

	
	//2월 2일 15시 4분부터 작업 (카카오 연동)
	// redirectUri: 프론트가 인가 요청 때 실제로 쓴 콜백 URL. 배포 도메인이 여러 개(beta/v3 등)일 수 있어서
	// 프론트가 자기 window.location.origin 기준으로 만든 값을 그대로 보내주면 그걸 토큰 교환에 그대로 사용한다.
	@GetMapping("/kakao/callback")
    public ResponseEntity<?> kakaoLogin(@RequestParam String code, @RequestParam(required = false) String redirectUri) {
        Map<String, Object> result = service.processKakaoLogin(code, redirectUri); // 인가 코드를 받기
        
        Object messageObj = result.get("message");
        
        String message = String.valueOf(messageObj);
        
        if(message.contains("잠금 모드")) {
        	return ResponseEntity.status(HttpStatus.FORBIDDEN).body(result);
        }
        
        return ResponseEntity.ok(result);
    }
	
	// 카카오 연동 해제는 더 이상 지원하지 않는다 — 해제 후 재로그인 시 LOGIN_ID(kakao_{providerUserId})가
	// 이미 존재하는 상태로 남아있어 재가입을 시도하다 충돌(500)이 나는 문제가 있었다. 프론트에서도
	// 버튼을 없앴지만, 과거 클라이언트가 남아있을 수 있어 서버에서도 명시적으로 막는다.
	@PostMapping("/kakao/unlink")
	public ResponseEntity<?> unlinkKaKao(@RequestHeader String authorization) {
		HashMap<String, String> res = new HashMap<>();
		res.put("message", "카카오로 가입한 계정은 연동 해제를 지원하지 않습니다.");
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(res);
	}
	
	
	

}