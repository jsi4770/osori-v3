package com.suin.fincoach.fx.model.vo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// FX_RATE_CACHE 한 행. (currency, rateDate)당 매매기준율(KRW per 1 unit) 1건.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FxRate {

	private String currency;
	private LocalDate rateDate;
	private BigDecimal rate;
	private String source; // eximbank | erapi | fallback | manual
	private LocalDateTime fetchedAt;
}
