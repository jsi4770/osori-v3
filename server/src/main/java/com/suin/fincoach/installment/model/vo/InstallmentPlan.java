package com.suin.fincoach.installment.model.vo;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstallmentPlan {

	private int planId; //할부 계획 ID
	private int userId; //사용자 ID
	private String title; //할부 항목명
	private int totalAmount; //총 할부 금액
	private int installmentMonths; //할부 개월수
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
	private LocalDate startDate; //첫 회차 결제일
	private String category; //카테고리
	private String memo; //메모
	private LocalDateTime createdAt; //등록일시

}
