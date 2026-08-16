package com.suin.fincoach.nlparse.model.dao;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.nlparse.model.vo.NlParseLog;

@Repository
public class NlParseLogDao {

	public int insert(SqlSessionTemplate sqlSession, NlParseLog log) {
		return sqlSession.insert("nlParseLogMapper.insert", log);
	}

}
