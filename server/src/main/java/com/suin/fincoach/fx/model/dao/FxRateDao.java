package com.suin.fincoach.fx.model.dao;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.fx.model.vo.FxRate;

@Repository
public class FxRateDao {

	public FxRate selectRate(SqlSessionTemplate sqlSession, String currency, LocalDate rateDate) {
		Map<String, Object> params = new HashMap<>();
		params.put("currency", currency);
		params.put("rateDate", rateDate);
		return sqlSession.selectOne("fxRateMapper.selectRate", params);
	}

	public int upsertRate(SqlSessionTemplate sqlSession, FxRate rate) {
		return sqlSession.insert("fxRateMapper.upsertRate", rate);
	}
}
