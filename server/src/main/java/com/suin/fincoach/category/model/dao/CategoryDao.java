package com.suin.fincoach.category.model.dao;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.category.model.vo.UserCategory;

@Repository
public class CategoryDao {

	public int insert(SqlSessionTemplate sqlSession, UserCategory category) {
		return sqlSession.insert("categoryMapper.insert", category);
	}

	public List<UserCategory> selectByUser(SqlSessionTemplate sqlSession, int userId, String type) {
		Map<String, Object> params = new HashMap<>();
		params.put("userId", userId);
		params.put("type", type);
		return sqlSession.selectList("categoryMapper.selectByUser", params);
	}

	public int deleteById(SqlSessionTemplate sqlSession, int categoryId) {
		return sqlSession.delete("categoryMapper.deleteById", categoryId);
	}

	public int deleteBySource(SqlSessionTemplate sqlSession, int userId, String type, String name, String source) {
		Map<String, Object> params = new HashMap<>();
		params.put("userId", userId);
		params.put("type", type);
		params.put("name", name);
		params.put("source", source);
		return sqlSession.delete("categoryMapper.deleteBySource", params);
	}

	public List<Map<String, Object>> selectCategoryFrequency(SqlSessionTemplate sqlSession, int userId, String type) {
		Map<String, Object> params = new HashMap<>();
		params.put("userId", userId);
		params.put("type", type);
		return sqlSession.selectList("categoryMapper.selectCategoryFrequency", params);
	}

}
