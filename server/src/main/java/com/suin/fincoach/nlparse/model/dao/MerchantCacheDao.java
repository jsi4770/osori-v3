package com.suin.fincoach.nlparse.model.dao;

import java.util.HashMap;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.nlparse.model.vo.MerchantCategoryCache;

@Repository
public class MerchantCacheDao {

	public MerchantCategoryCache selectByUserAndMerchant(SqlSessionTemplate sqlSession, int userId, String merchant) {
		Map<String, Object> params = new HashMap<>();
		params.put("userId", userId);
		params.put("merchant", merchant);
		return sqlSession.selectOne("merchantCacheMapper.selectByUserAndMerchant", params);
	}

	// 같은 유저+가맹점이면 카테고리를 최신값으로 갱신하고 hit_count만 증가(학습이 누적될수록 신뢰도↑)
	public int upsert(SqlSessionTemplate sqlSession, MerchantCategoryCache cache) {
		return sqlSession.insert("merchantCacheMapper.upsert", cache);
	}

}
