package com.suin.fincoach.category.model.service;

import java.util.List;
import java.util.Map;

import com.suin.fincoach.category.model.vo.UserCategory;

public interface CategoryService {

	// 기본 카테고리(숨김 제외) + 커스텀 카테고리를, 이 사용자의 사용 빈도 내림차순으로 정렬해 반환.
	// 지출 등록 폼/차트 등 "선택 가능한 카테고리 목록"이 필요한 모든 곳에서 공용으로 쓴다.
	List<String> getMergedCategories(int userId, String type);

	// 설정 화면(카테고리 관리)용 상세 뷰: 기본 카테고리는 숨김 여부와 함께, 커스텀 카테고리는 삭제용 ID와 함께 반환.
	Map<String, Object> getManageView(int userId, String type);

	// 이 사용자가 자주 쓰는 카테고리 상위 N개 (Gemini 프롬프트 힌트용). 사용 이력이 없으면 빈 리스트.
	List<String> getTopUsedCategories(int userId, String type, int limit);

	UserCategory addCustom(int userId, String type, String name);

	void deleteCustom(int categoryId);

	void setHidden(int userId, String type, String name, boolean hidden);

}
