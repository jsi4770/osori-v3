package com.suin.fincoach.category.model.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.suin.fincoach.category.CategoryDefaults;
import com.suin.fincoach.category.model.dao.CategoryDao;
import com.suin.fincoach.category.model.vo.UserCategory;

@Service
public class CategoryServiceImpl implements CategoryService {

	@Autowired
	private CategoryDao dao;

	@Autowired
	private SqlSessionTemplate sqlSession;

	@Override
	public List<String> getMergedCategories(int userId, String type) {
		String txType = normalizeType(type);
		List<UserCategory> rows = dao.selectByUser(sqlSession, userId, txType);

		Set<String> hidden = new HashSet<>();
		List<String> custom = new ArrayList<>();
		for (UserCategory row : rows) {
			if ("HIDDEN_DEFAULT".equals(row.getSource())) {
				hidden.add(row.getName());
			} else if ("CUSTOM".equals(row.getSource())) {
				custom.add(row.getName());
			}
		}

		List<String> merged = new ArrayList<>();
		for (String name : CategoryDefaults.forType(txType)) {
			if (!hidden.contains(name)) {
				merged.add(name);
			}
		}
		merged.addAll(custom);

		Map<String, Integer> frequency = frequencyMap(userId, txType);
		merged.sort((a, b) -> frequency.getOrDefault(b, 0) - frequency.getOrDefault(a, 0));

		return merged;
	}

	@Override
	public Map<String, Object> getManageView(int userId, String type) {
		String txType = normalizeType(type);
		List<UserCategory> rows = dao.selectByUser(sqlSession, userId, txType);

		Set<String> hidden = new HashSet<>();
		List<Map<String, Object>> custom = new ArrayList<>();
		for (UserCategory row : rows) {
			if ("HIDDEN_DEFAULT".equals(row.getSource())) {
				hidden.add(row.getName());
			} else if ("CUSTOM".equals(row.getSource())) {
				Map<String, Object> c = new HashMap<>();
				c.put("categoryId", row.getCategoryId());
				c.put("name", row.getName());
				custom.add(c);
			}
		}

		List<Map<String, Object>> defaults = new ArrayList<>();
		for (String name : CategoryDefaults.forType(txType)) {
			Map<String, Object> d = new HashMap<>();
			d.put("name", name);
			d.put("hidden", hidden.contains(name));
			defaults.add(d);
		}

		Map<String, Object> result = new HashMap<>();
		result.put("defaults", defaults);
		result.put("custom", custom);
		return result;
	}

	@Override
	public List<String> getTopUsedCategories(int userId, String type, int limit) {
		String txType = normalizeType(type);
		List<Map<String, Object>> rows = dao.selectCategoryFrequency(sqlSession, userId, txType);

		List<String> top = new ArrayList<>();
		for (Map<String, Object> row : rows) {
			if (top.size() >= limit) break;
			Object category = row.get("category");
			if (category != null) {
				top.add(String.valueOf(category));
			}
		}
		return top;
	}

	@Override
	public UserCategory addCustom(int userId, String type, String name) {
		String txType = normalizeType(type);
		String trimmed = name == null ? "" : name.trim();

		if (trimmed.isEmpty()) {
			throw new IllegalArgumentException("카테고리 이름을 입력해주세요.");
		}
		if (trimmed.length() > 50) {
			throw new IllegalArgumentException("카테고리 이름은 50자 이하로 입력해주세요.");
		}
		if (getMergedCategories(userId, txType).contains(trimmed)) {
			throw new IllegalArgumentException("이미 있는 카테고리입니다.");
		}

		UserCategory category = UserCategory.builder()
				.userId(userId)
				.type(txType)
				.name(trimmed)
				.source("CUSTOM")
				.build();

		dao.insert(sqlSession, category);
		return category;
	}

	@Override
	public void deleteCustom(int categoryId) {
		dao.deleteById(sqlSession, categoryId);
	}

	@Override
	public void setHidden(int userId, String type, String name, boolean hidden) {
		String txType = normalizeType(type);

		if (!CategoryDefaults.forType(txType).contains(name)) {
			throw new IllegalArgumentException("기본 카테고리만 숨길 수 있습니다.");
		}

		if (hidden) {
			List<UserCategory> rows = dao.selectByUser(sqlSession, userId, txType);
			boolean alreadyHidden = rows.stream()
					.anyMatch(r -> "HIDDEN_DEFAULT".equals(r.getSource()) && name.equals(r.getName()));
			if (alreadyHidden) return;

			UserCategory row = UserCategory.builder()
					.userId(userId)
					.type(txType)
					.name(name)
					.source("HIDDEN_DEFAULT")
					.build();
			dao.insert(sqlSession, row);
		} else {
			dao.deleteBySource(sqlSession, userId, txType, name, "HIDDEN_DEFAULT");
		}
	}

	private Map<String, Integer> frequencyMap(int userId, String type) {
		List<Map<String, Object>> rows = dao.selectCategoryFrequency(sqlSession, userId, type);
		Map<String, Integer> map = new HashMap<>();
		for (Map<String, Object> row : rows) {
			Object category = row.get("category");
			Object cnt = row.get("cnt");
			if (category != null && cnt instanceof Number) {
				map.put(String.valueOf(category), ((Number) cnt).intValue());
			}
		}
		return map;
	}

	private String normalizeType(String type) {
		return "IN".equalsIgnoreCase(type) ? "IN" : "OUT";
	}

}
