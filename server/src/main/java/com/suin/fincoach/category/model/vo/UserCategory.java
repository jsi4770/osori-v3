package com.suin.fincoach.category.model.vo;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserCategory {

	private int categoryId;
	private int userId;
	private String type; // IN | OUT
	private String name;
	private String source; // CUSTOM | HIDDEN_DEFAULT
	private LocalDateTime createdAt;

}
