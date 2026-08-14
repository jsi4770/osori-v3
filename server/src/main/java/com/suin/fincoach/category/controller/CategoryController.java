package com.suin.fincoach.category.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.suin.fincoach.category.model.service.CategoryService;
import com.suin.fincoach.category.model.vo.UserCategory;

@RestController
@RequestMapping("/category")
@CrossOrigin
public class CategoryController {

	@Autowired
	private CategoryService service;

	// 기본(숨김 제외) + 커스텀 카테고리를 이 사용자의 사용 빈도순으로 반환 — 지출 등록 폼 등 선택 목록용
	@GetMapping("/{userId}/{type}")
	public ResponseEntity<?> list(@PathVariable int userId, @PathVariable String type) {
		return ResponseEntity.ok(service.getMergedCategories(userId, type));
	}

	// 설정 화면(카테고리 관리) 전용 — 기본 카테고리 숨김 여부 + 커스텀 카테고리 목록
	@GetMapping("/{userId}/{type}/manage")
	public ResponseEntity<?> manage(@PathVariable int userId, @PathVariable String type) {
		return ResponseEntity.ok(service.getManageView(userId, type));
	}

	@PostMapping
	public ResponseEntity<?> addCustom(@RequestBody Map<String, Object> body) {
		try {
			int userId = toInt(body.get("userId"));
			String type = String.valueOf(body.get("type"));
			String name = body.get("name") == null ? null : String.valueOf(body.get("name"));

			UserCategory created = service.addCustom(userId, type, name);
			return ResponseEntity.status(HttpStatus.CREATED).body(created);
		} catch (IllegalArgumentException e) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
		}
	}

	@DeleteMapping("/{categoryId}")
	public ResponseEntity<?> deleteCustom(@PathVariable int categoryId) {
		service.deleteCustom(categoryId);
		return ResponseEntity.ok(Map.of("ok", true));
	}

	@PatchMapping("/hidden")
	public ResponseEntity<?> setHidden(@RequestBody Map<String, Object> body) {
		try {
			int userId = toInt(body.get("userId"));
			String type = String.valueOf(body.get("type"));
			String name = body.get("name") == null ? null : String.valueOf(body.get("name"));
			boolean hidden = Boolean.parseBoolean(String.valueOf(body.get("hidden")));

			service.setHidden(userId, type, name, hidden);
			return ResponseEntity.ok(Map.of("ok", true));
		} catch (IllegalArgumentException e) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
		}
	}

	private int toInt(Object value) {
		if (value == null) return 0;
		if (value instanceof Number) return ((Number) value).intValue();
		try {
			return Integer.parseInt(String.valueOf(value).trim());
		} catch (NumberFormatException e) {
			return 0;
		}
	}

}
