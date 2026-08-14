package com.suin.fincoach.installment.model.dao;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.installment.model.vo.InstallmentPlan;

@Repository
public class InstallmentDao {

	public int insertPlan(SqlSessionTemplate sqlSession, InstallmentPlan plan) {

		return sqlSession.insert("installmentMapper.insertPlan", plan);
	}

}
