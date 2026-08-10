package com.suin.fincoach.nlparse.model.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MerchantCategoryCache {

	private int cacheId;
	private int userId;
	private String merchant; // 정규화(trim + lowercase)해서 저장/조회
	private String category;
	private int hitCount;

}
