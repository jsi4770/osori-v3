package com.suin.fincoach.fx;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.suin.fincoach.fx.model.vo.FxRateResult;

class FxRateResultTest {

	@Test
	void toKrw_roundsHalfUp() {
		FxRateResult r = FxRateResult.builder()
				.currency("GBP").rate(new BigDecimal("1730.5"))
				.rateDate(LocalDate.of(2026, 8, 10)).source("eximbank").stale(false).build();

		assertEquals(51915, r.toKrw(new BigDecimal("30")));      // 30 * 1730.5 = 51915
		assertEquals(1731, r.toKrw(new BigDecimal("1")));        // 1730.5 -> 1731 (half-up)
		assertEquals(0, r.toKrw(null));
	}

	@Test
	void toKrw_zeroRateIsSafe() {
		FxRateResult r = FxRateResult.builder().currency("USD").rate(null).build();
		assertEquals(0, r.toKrw(new BigDecimal("10")));
	}
}
