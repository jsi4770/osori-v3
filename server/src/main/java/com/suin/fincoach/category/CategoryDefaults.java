package com.suin.fincoach.category;

import java.util.List;

// app/src/constants/categories.js의 EXPENSE_CATEGORIES/INCOME_CATEGORIES와 동일하게 유지해야 함.
// nlparse(Gemini 프롬프트)와 category 패키지(병합 리스트 계산)가 같은 기본값을 공유하도록 여기 하나로 모음.
public final class CategoryDefaults {

	private CategoryDefaults() {}

	public static final List<String> EXPENSE_CATEGORIES = List.of(
			"식비", "생활/마트", "쇼핑", "의료/건강", "교통", "문화/여가", "교육",
			"주거/월세", "통신비", "보험", "구독서비스", "기타");

	public static final List<String> INCOME_CATEGORIES = List.of(
			"월급", "용돈", "금융소득", "상여금", "기타");

	public static List<String> forType(String type) {
		return "IN".equals(type) ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
	}

}
