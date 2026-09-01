package com.suin.fincoach.trans.model.vo;

import java.math.BigDecimal;
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

	// --- 외화(FX) ---
	// originalAmount는 계속 "원화 금액"(소스 오브 트루스). 아래는 외화로 입력된 거래의 스냅샷이다.
	private String currency;        // 원본 통화 코드(KRW|USD|JPY|EUR|GBP|CNY|TWD). null/KRW = 순수 원화
	private BigDecimal fxAmount;    // 원본 외화 금액 (currency != KRW일 때만)
	private BigDecimal fxRate;      // 적용 환율 (KRW per 1 unit)
	@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
	private LocalDate fxRateDate;   // 환율 기준일 (주말/공휴일이면 직전 영업일로 당겨질 수 있음)
	private String fxRateSource;    // eximbank | erapi | fallback | manual

	// 요청 전용(DB 미저장): 사용자가 명세서 등을 보고 환산 원화값을 직접 지정했는지 여부.
	// true면 서버는 originalAmount를 재계산하지 않고 클라이언트 값을 그대로 저장한다.
	private Boolean krwOverride;

}