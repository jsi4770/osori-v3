package com.suin.fincoach.fx.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.suin.fincoach.fx.model.vo.FxRateResult;

public interface FxRateService {

	// 지정한 통화의 지정한 날짜(거래일) 기준 환율. date가 null이면 오늘(KST). currency=KRW면 rate=1.
	// 주말/공휴일이면 직전 영업일 환율로 폴백하며, 그 사실은 결과의 rateDate/stale로 알 수 있다.
	FxRateResult getRate(String currency, LocalDate date);

	// 지원 통화 목록(코드/한글명/기호/국기 이모지) — 프론트 통화 선택 UI용.
	List<Map<String, Object>> supportedCurrencies();

	boolean isSupported(String currency);
}
