package com.suin.fincoach.fixedtrans.model.dto.request;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Builder
@Data
public class FixedTransUpdateRequest {

	private int userId;
	private String name;
	private int amount;
	private String category;
	private int payDay;

	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
	private LocalDate transDate;

	private int fixedId;

	// 외화 고정지출: currency != KRW면 amount(원화)는 참고값이고 매달 결제일 환율로 재환산한다.
	private String currency;
	private BigDecimal fxAmount;

}
