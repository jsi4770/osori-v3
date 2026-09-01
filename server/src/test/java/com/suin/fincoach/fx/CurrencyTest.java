package com.suin.fincoach.fx;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.suin.fincoach.fx.model.vo.Currency;

class CurrencyTest {

	@Test
	void of_normalizesAndFallsBackToKrw() {
		assertEquals(Currency.USD, Currency.of("usd"));
		assertEquals(Currency.GBP, Currency.of(" GBP "));
		assertEquals(Currency.KRW, Currency.of(null));
		assertEquals(Currency.KRW, Currency.of(""));
		assertEquals(Currency.KRW, Currency.of("BTC")); // 미지원 코드는 원화로 폴백
	}

	@Test
	void isSupported() {
		assertTrue(Currency.isSupported("JPY"));
		assertTrue(Currency.isSupported("twd"));
		assertFalse(Currency.isSupported(null));
		assertFalse(Currency.isSupported("XAU"));
	}

	@Test
	void eximbankUnitMapping() {
		assertEquals("JPY(100)", Currency.JPY.eximUnit);
		assertEquals(100, Currency.JPY.eximDivisor);
		assertEquals("CNH", Currency.CNY.eximUnit); // 위안은 수은 고시상 CNH(역외)
		assertEquals(null, Currency.TWD.eximUnit);  // 대만달러는 수은 미고시 -> er-api로만
	}
}
