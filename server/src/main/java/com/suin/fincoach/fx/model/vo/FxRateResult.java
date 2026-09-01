package com.suin.fincoach.fx.model.vo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// 환율 해석 결과. rate는 항상 "1 통화단위 = rate 원"(KRW per 1 unit).
// rateDate는 실제 적용된 환율의 기준일 — 요청일이 주말/공휴일이면 직전 영업일로 당겨질 수 있다.
// stale이 true면 폴백/근사치라 부정확할 수 있다는 뜻(UI에서 "추정" 표시).
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FxRateResult {

	private String currency;
	private BigDecimal rate;
	private LocalDate rateDate;
	private String source; // eximbank | erapi | fallback | manual | krw
	private boolean stale;

	// 외화 금액 -> 원화(반올림, 원 단위). 저장 시 ORIGINAL_AMOUNT 계산에 사용.
	public int toKrw(BigDecimal foreignAmount) {
		if (foreignAmount == null || rate == null) {
			return 0;
		}
		return rate.multiply(foreignAmount).setScale(0, RoundingMode.HALF_UP).intValue();
	}
}
