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
import com.suin.fincoach.user.model.service.UserService;
import com.suin.fincoach.user.model.vo.User;
import com.suin.fincoach.util.JwtUtil;

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

		// LOGIN_ID로 사용자 조회 (해시 password까지 가져오기)
		User loginUser = service.selectUser(user);

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
				map.put("message", "아이디와 비밀번호를 다시 입력해주세요.");
				
			}

		} 

		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(map); // 비회원일때 처리

	}

	//회원 가입
	@PostMapping("/register")
	public ResponseEntity<?> insertUser(@RequestBody UserRegisterRequest request) {

		User user = request.getUser();

		user.setPassword(bcrypt.encode(user.getPassword())); // 갖고 온 비밀번호를 평문이 아닌 암호화된 비밀번호로 처리

		int result = service.insertUser(request); // 회원 가입 처리

		if(result >= 2) {
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

	// 아이디 중복 체크 (UNIQUE 제약 조건으로 인해 중복 체크 해줘야한다.)
	@GetMapping("/checkId")
	public ResponseEntity<?> idCheck(@RequestParam("loginId") String loginId) {

		String v = (loginId == null) ? "" : loginId.trim();

		int count = service.idCheck(v);

		HashMap<String, Object> resp = new HashMap<>();

		resp.put("count", count);

		return ResponseEntity.ok(resp);

	}

	// 닉네임 중복 체크 (UNIQUE 제약 조건으로 인해 중복 체크 해줘야한다.)
	@GetMapping("/checkNickName")
	public ResponseEntity<?> nickNameCheck(@RequestParam("nickName") String nickName) {

		// count만 JSON으로 응답
		String v = (nickName == null) ? "" : nickName.trim();

		int count = service.nickNameCheck(v);

		HashMap<String, Object> resp = new HashMap<>();

		resp.put("count", count);

		return ResponseEntity.ok(resp);
	}

	// 이메일 중복 체크 (UNIQUE 제약 조건으로 인해 중복 체크 해줘야한다.)
	@GetMapping("/checkEmail")
	public ResponseEntity<?> emailCheck(@RequestParam("email") String email) {

		// 이메일은 대소문자/공백 때문에 헷갈릴 수 있어서 trim + lower 처리
		String v = (email == null) ? "" : email.trim().toLowerCase();

		int count = service.emailCheck(v);

		HashMap<String, Object> resp = new HashMap<>();

		resp.put("count", count);

		return ResponseEntity.ok(resp);
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

	// 아이디 찾기 메소드
	@PostMapping("/findId")
	public ResponseEntity<?> findLoginIdByEmail(@RequestBody Map<String, String> emailMap) {

		HashMap<String, String> res = new HashMap<>();

		String email = emailMap.get("email");

		User loginUser = service.findLoginIdByEmail(email); // 이메일 기반으로 유저 찾기

		if (loginUser != null) {

			res.put("loginId", loginUser.getLoginId());

			return ResponseEntity.ok(res);

		} else {

			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("회원 정보가 없습니다.");

		}

	}

	// 비밀번호 찾기 1단계
	@PostMapping("/findPassword")
	public ResponseEntity<?> findPassword(@RequestBody Map<String, String> loginIdMap) {

		HashMap<String, String> res = new HashMap<>();

		String loginId = loginIdMap.get("loginId");

		User loginUser = service.selectByLoginId(loginId);

		if (loginUser != null) {

			return ResponseEntity.ok("회원 정보가 조회 되어 비밀번호 재설정 페이지로 이동합니다.");

		} else {

			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("회원 정보가 없습니다.");

		}

	}

	// 비밀번호 재설정 2단계
	@PatchMapping("/resetPassword")
	public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> userMap) {

		String newPassword = userMap.get("newPassword"); // 비밀번호 재설정 페이지에서 사용자가 입력한 비밀번호 갖고 오기

		newPassword = bcrypt.encode(newPassword); // 갖고 온 비밀번호를 암호화

		userMap.put("newPassword", newPassword); // 맵에 있는 값을 수정

		int result = service.resetPassword(userMap); // 수정한 값을 바탕으로 집어넣기

		if (result > 0) {

			return ResponseEntity.ok("비밀번호가 수정 됐습니다.");

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