package com.suin.fincoach.user.model.dao;

import java.sql.Timestamp;
import java.util.HashMap;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.user.model.vo.EmailVerification;

@Repository
public class EmailVerificationDao {

	public int insert(SqlSessionTemplate sqlSession, String email, String purpose, String codeHash, Timestamp expiresAt) {
		Map<String, Object> params = new HashMap<>();
		params.put("email", email);
		params.put("purpose", purpose);
		params.put("codeHash", codeHash);
		params.put("expiresAt", expiresAt);
		return sqlSession.insert("emailVerificationMapper.insert", params);
	}

	public EmailVerification findActive(SqlSessionTemplate sqlSession, String email, String purpose) {
		return sqlSession.selectOne("emailVerificationMapper.findActive", params(email, purpose));
	}

	public EmailVerification findLatest(SqlSessionTemplate sqlSession, String email, String purpose) {
		return sqlSession.selectOne("emailVerificationMapper.findLatest", params(email, purpose));
	}

	public int consumeAllFor(SqlSessionTemplate sqlSession, String email, String purpose) {
		return sqlSession.update("emailVerificationMapper.consumeAllFor", params(email, purpose));
	}

	public int incrementAttempts(SqlSessionTemplate sqlSession, int id) {
		return sqlSession.update("emailVerificationMapper.incrementAttempts", id);
	}

	public int markConsumed(SqlSessionTemplate sqlSession, int id) {
		return sqlSession.update("emailVerificationMapper.markConsumed", id);
	}

	private Map<String, Object> params(String email, String purpose) {
		Map<String, Object> params = new HashMap<>();
		params.put("email", email);
		params.put("purpose", purpose);
		return params;
	}
}
