package com.suin.fincoach.nlparse.model.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NlInputHistory {

	private int historyId;
	private int userId;
	private String type; // "IN" | "OUT"
	private String inputText;
	private int useCount;

}
