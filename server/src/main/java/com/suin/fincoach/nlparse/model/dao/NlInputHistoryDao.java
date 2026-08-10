package com.suin.fincoach.nlparse.model.dao;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.nlparse.model.vo.NlInputHistory;

@Repository
public class NlInputHistoryDao {

	public int upsert(SqlSessionTemplate sqlSession, NlInputHistory history) {
		return sqlSession.insert("nlInputHistoryMapper.upsert", history);
	}

	public List<String> selectTopTexts(SqlSessionTemplate sqlSession, int userId, String type, int limit) {
		Map<String, Object> params = new HashMap<>();
		params.put("userId", userId);
		params.put("type", type);
		params.put("limit", limit);
		return sqlSession.selectList("nlInputHistoryMapper.selectTopTexts", params);
	}

}
