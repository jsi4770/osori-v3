package com.suin.fincoach.nlparse.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class RegexExpenseParserCurrencyTest {

	@Test
	void parseCurrency_detectsUnitsAdjacentToNumbers() {
		assertEquals("USD", RegexExpenseParser.parseCurrency("런던에서 30달러 점심"));
		assertEquals("USD", RegexExpenseParser.parseCurrency("$30 커피"));
		assertEquals("JPY", RegexExpenseParser.parseCurrency("3000엔 라멘"));
		assertEquals("EUR", RegexExpenseParser.parseCurrency("20유로 기념품"));
		assertEquals("GBP", RegexExpenseParser.parseCurrency("£12.5 택시"));
		assertEquals("CNY", RegexExpenseParser.parseCurrency("50위안 택시"));
		assertEquals("TWD", RegexExpenseParser.parseCurrency("300 대만달러 야시장"));
	}

	@Test
	void parseCurrency_ignoresUnitsNotNextToNumbers() {
		// "이번엔"에 '엔'이 들어있지만 숫자에 붙어있지 않으므로 통화로 오인하지 않는다.
		assertNull(RegexExpenseParser.parseCurrency("이번엔 5000원 썼다"));
		assertNull(RegexExpenseParser.parseCurrency("스타벅스 아메리카노 5천원"));
		assertNull(RegexExpenseParser.parseCurrency(null));
	}

	@Test
	void parseForeignAmount_extractsNumberNextToUnit() {
		assertEquals(30, RegexExpenseParser.parseForeignAmount("런던에서 30파운드 점심"));
		assertEquals(1500, RegexExpenseParser.parseForeignAmount("1,500엔 도시락"));
		assertEquals(13, RegexExpenseParser.parseForeignAmount("$12.5 커피")); // 12.5 -> 반올림 13
		assertNull(RegexExpenseParser.parseForeignAmount("그냥 5천원"));
	}
}
