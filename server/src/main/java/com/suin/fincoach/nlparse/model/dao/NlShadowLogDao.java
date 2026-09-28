package com.suin.fincoach.nlparse.model.dao;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.nlparse.model.vo.NlShadowLog;

@Repository
public class NlShadowLogDao {

	public int insert(SqlSessionTemplate sqlSession, NlShadowLog log) {
		return sqlSession.insert("nlShadowLogMapper.insert", log);
	}

}
