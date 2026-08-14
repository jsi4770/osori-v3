package com.suin.fincoach.trans.model.vo;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Mytrans {
	
	private String type; //수입/지출
	private int transId; //지출번호
	private String title; //가게명 or 거래내역
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
	private LocalDate transDate; //거래날짜
	private int originalAmount; //금액
	private String isShared; //그룹에서 가지고 온지 여부
	private String category; //카테고리
	@JsonProperty("groupTransId") 
	private Integer groupBId; //
	private String memo; //메모
	private int userId; //사용자id
	private String excludeAnalysis; //분석(이상치 탐지/그래프/코칭)에서 제외 여부 - Y/N
	private Integer installmentId; //할부 계획 ID (할부로 생성된 회차가 아니면 null)

}