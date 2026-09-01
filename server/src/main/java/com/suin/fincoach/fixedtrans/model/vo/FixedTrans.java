package com.suin.fincoach.fixedtrans.model.vo;

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
public class FixedTrans {

	private int fixedId; // 고정 지출 아이디
	private String name; // 고정 지출 사유
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
	private LocalDate transDate; // 거래 날짜
	private int amount; // 고정 지출(원화 환산액 — 외화면 최근 결제 반영 시점 환율 기준 참고값)
	private String category; // 카테고리
	private int payDay; // 고정 지출 발생일
	private int userId; // 참조 회원 아이디

	// 외화 고정지출(해외 구독 등). 정기결제는 환율을 고정하지 않고 매달 결제일 환율로 다시 환산한다.
	private String currency;     // KRW|USD|JPY|EUR|GBP|CNY|TWD. null/KRW = 순수 원화
	private BigDecimal fxAmount; // 원본 외화 금액 (currency != KRW일 때)
}
