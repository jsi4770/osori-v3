package com.suin.fincoach.util;

import java.util.Date;


import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;


import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;


/*
 * JwtUtil : jwt 토큰 생성 및 검증을 담당하는 유틸리티 클래스
 * JWT (Json Web Token) : 사용자 인증 정보를 안전하게 전달하기 위한 표준 방식 
 * 세션 대신 토큰 방식을 이용하여 서버 부하를 줄이고 확장성을 높인다.
 * */

@Component // spring 에서 관리할 수 있도록 컴포넌트화 시키기 
public class JwtUtil {

  
	//application.properties에 작성한 키값으로 데이터 불러오기
	//@Value 어노테이션을 이용하여 해당 키값을 읽어온다.
	//만약 해당 키값에 데이터가 존재하지 않으면 사용할 기본값 설정 ${키값 : default값}
	@Value("${jwt.secret:mySecretkeybackupTokenkey123}")
	private String secret; 
	
	//토큰 유효기간
	//보안을 위해 토큰만료기간을 두어 탈취되었을때도 무한정 사용할 수 없도록 하기 위함
	@Value("${jwt.expiration:864000000}")
	private long expiration;

	//비밀번호 재설정 전용 토큰의 유효기간 (기본 10분) — 로그인 토큰보다 훨씬 짧게 두어 탈취 시 피해를 줄인다.
	@Value("${jwt.pwreset-expiration:600000}")
	private long pwResetExpiration;

	//이메일 인증 완료 토큰의 유효기간 (기본 30분) — 인증코드 확인 후 회원가입/재설정 폼 제출까지의 여유.
	@Value("${jwt.email-verified-expiration:1800000}")
	private long emailVerifiedExpiration;

    
	//JWT 토큰에 디지털 서명을 하기 위한 암호화 키를 생성하는 메소드
	private SecretKey getSignKey() {
		//secret 문자열을 바이트 배열로 변환후 HMAC 키로 변환
		//HMAC - SHA256 알고리즘을 사용하여 토큰의 무결성을 보장한다.
		//같은 키로 서명한 토큰만 유효하다고 인증하기 위해(위조 방지)
		
		
		
		return Keys.hmacShaKeyFor(secret.getBytes());
		
	}
	
	//사용자 로그인시 jwt 토큰을 생성하는 메소드
	//매개변수 : userId : 토큰에 포함할 사용자 식별자데이터
	//반환값 : 생성된 JWT 토큰 반환열
	public String generateToken(String loginId) {
		Date now = new Date(); // 현재 시간을 토큰 발급시간으로 지정하기
		Date expiryDate = new Date(now.getTime()+expiration); // 현재시간 + 만료시간
		
		//JWT 토큰 빌더를 이용해서 사용
		return Jwts.builder()
					.setSubject(loginId) // subject : 토큰의 주제(누구에 대한 토큰인지, 일반적으로 사용자 ID나 이메일 사용)
					.setIssuedAt(now) // issueDat : 토큰이 언제 발급되었는지 기록
					.setExpiration(expiryDate) // expiration : 토큰이 언제 만료되는지 
					.signWith(getSignKey()) //signWith : 생성된 암호화키로 토크에 디지털 서명(위조 방지) 
					.compact(); // 최종적으로 JWT 문자열형태로 압축하여 반화한다. header.payload.signature 형태의 문자열 생성
	}
	
	//JWT 토큰에서 사용자 ID를 추출하는 메소드
	//매개변수 : token - 파싱할 JWT 토큰 문자열
	//반환값 : 토큰에 저장된 사용자 ID
	//의도 : API 요청시 토큰으로부터 현재 사용자가 누구인지 파악하기 위함
	public String getloginIdFromToken(String token) {
		//JWT 파서를 이용하여 토큰 해독
		Claims claims = Jwts.parserBuilder() // JWT파서 빌더 시작
							.setSigningKey(getSignKey()) // 서명검증을 위한 키 (토큰 생성시 사용한 키를 이용해야함)
							.build() // 파서 객체 생성 완료
							.parseClaimsJws(token) // 위에서 생성한 파서 객체 파싱하고 서명 검증하기
							.getBody(); // Claims 객체 추출 (토큰의 payload 부분)
		
		System.out.println(claims); 
		
		//생성된 Claims에서 subject(주체) 정보 반환
		return claims.getSubject();
	}
	
	// 비밀번호 재설정 전용 단기 토큰 생성.
	// - subject: 대상 USER_ID (숫자)
	// - purpose 클레임("pwreset")으로 일반 로그인 토큰과 구분 → 로그인 토큰을 재설정에 재사용하지 못하게 함
	public String generatePasswordResetToken(int userId) {
		Date now = new Date();
		Date expiryDate = new Date(now.getTime() + pwResetExpiration);

		return Jwts.builder()
					.setSubject(String.valueOf(userId))
					.claim("purpose", "pwreset")
					.setIssuedAt(now)
					.setExpiration(expiryDate)
					.signWith(getSignKey())
					.compact();
	}

	// 재설정 토큰을 검증하고 대상 USER_ID를 반환. 서명 위조·만료·purpose 불일치·형식 오류면 -1.
	public int parsePasswordResetToken(String token) {
		try {
			Claims claims = Jwts.parserBuilder()
								.setSigningKey(getSignKey())
								.build()
								.parseClaimsJws(token)
								.getBody();

			if (!"pwreset".equals(claims.get("purpose", String.class))) {
				return -1;
			}

			return Integer.parseInt(claims.getSubject());
		} catch (JwtException | NumberFormatException e) {
			return -1;
		}
	}

	// 이메일 본인인증 완료 토큰 생성. 인증코드 확인에 성공한 (email, purpose) 조합에 대해 발급한다.
	// - subject: 인증된 이메일
	// - purpose: "email:SIGNUP" / "email:RESET" 등 — 용도가 다른 토큰을 서로 못 쓰게 함
	public String generateEmailVerifiedToken(String email, String purpose) {
		Date now = new Date();
		Date expiryDate = new Date(now.getTime() + emailVerifiedExpiration);

		return Jwts.builder()
					.setSubject(email)
					.claim("purpose", "email:" + purpose)
					.setIssuedAt(now)
					.setExpiration(expiryDate)
					.signWith(getSignKey())
					.compact();
	}

	// 이메일 인증 토큰을 검증하고 인증된 이메일을 반환. 서명·만료·purpose 불일치면 null.
	public String parseEmailVerifiedToken(String token, String expectedPurpose) {
		try {
			Claims claims = Jwts.parserBuilder()
								.setSigningKey(getSignKey())
								.build()
								.parseClaimsJws(token)
								.getBody();

			if (!("email:" + expectedPurpose).equals(claims.get("purpose", String.class))) {
				return null;
			}

			return claims.getSubject();
		} catch (JwtException e) {
			return null;
		}
	}

	// JWT 토큰이 유효한지 검증하는 메소드
	public boolean validateToken(String token) {
		try {
			//토큰 파싱 시도 - 성공하면 유효 토큰 실패하면 문제발생
			Jwts.parserBuilder()
				.setSigningKey(getSignKey()) // 서명 검증용 키
				.build()
				.parseClaimsJws(token);  //토큰 파싱 및 검증 수행
			//검증시 서명이 올바른지, 토큰형식이 올바른지, 토큰이 만료되지 않았는지 확인한다. 
			
			return true; 
		} catch(JwtException e) {
			
			//JwtException : JWT 관련 모든 예외의 상위 클래스
			
			e.printStackTrace();
			
			return false; // 어떤 예외던 발생하면 유효하지 않은 토큰으로 간주한다.
			
		}
	}
	
	//만약 JWT토큰의 만료여부만 확인하고 싶다면
	public boolean isTokenExpired(String token) {
		try {
			//토큰에서 데이터묶음 반환받기
			Claims claims = Jwts.parserBuilder()
								.setSigningKey(getSignKey())
								.build()
								.parseClaimsJws(token)
								.getBody();
			
			//토큰에 담겨있던 만료기간과 현재 시간 비교
			//before() : 만료시간이 현재시간보다 이전이면 true(만료) 이후면 false(만료전)
			
			return claims.getExpiration().before(new Date());
		} catch(JwtException e) {
			//토큰 파싱 실패하면 유효하지 않음으로 간주 
			return false;
		}
	}
	
	
	

}