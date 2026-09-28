package com.suin.fincoach.nlparse.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

// LLM 제거 대비: 한글 수사 금액 + 상대 날짜 확장 파싱 (server/ml/nlparse 자체 모델 전환 관련).
// server/eval/nlparse/run_eval.py 의 파이썬 포팅과 동작이 일치해야 한다.
class RegexExpenseParserKoreanTest {

	@Test
	void parseAmount_koreanNumerals() {
		assertEquals(15000, RegexExpenseParser.parseAmount("치낀 만오천원"));
		assertEquals(15000, RegexExpenseParser.parseAmount("택시비 만오천원"));
		assertEquals(3500, RegexExpenseParser.parseAmount("카페 삼천오백원"));
		assertEquals(10000, RegexExpenseParser.parseAmount("그냥 만원 씀"));
		assertEquals(23000, RegexExpenseParser.parseAmount("이만삼천원"));
		assertEquals(150000, RegexExpenseParser.parseAmount("십오만원"));
		assertEquals(8500, RegexExpenseParser.parseAmount("회사근처 식당에서 점심 8천5백원"));
		assertEquals(45000, RegexExpenseParser.parseAmount("저번주 삼겹살 4만5천원"));
	}

	@Test
	void parseAmount_keepsExistingDigitBehavior() {
		assertEquals(5000, RegexExpenseParser.parseAmount("스벅 아아 5천원"));
		assertEquals(15000, RegexExpenseParser.parseAmount("택시 15000원"));
		assertEquals(89000, RegexExpenseParser.parseAmount("홧김에 지른 옷값 8만9천원"));
		assertEquals(32000, RegexExpenseParser.parseAmount("마트에서 32,000원"));
		assertNull(RegexExpenseParser.parseAmount("회사 앞 카페 다녀옴"));
	}

	@Test
	void parseDate_relativeMonthAndWeekday() {
		LocalDate today = LocalDate.of(2026, 9, 2); // 수요일

		assertEquals(LocalDate.of(2026, 8, 31), RegexExpenseParser.parseDate("이번주 월요일", today));
		assertEquals(LocalDate.of(2026, 8, 25), RegexExpenseParser.parseDate("지난주 화요일에", today));
		assertEquals(LocalDate.of(2026, 8, 19), RegexExpenseParser.parseDate("지지난주 수요일에 결제", today));
		assertEquals(LocalDate.of(2026, 7, 15), RegexExpenseParser.parseDate("지지난달 15일에 낸 보험료", today));
		assertEquals(LocalDate.of(2026, 8, 25), RegexExpenseParser.parseDate("지난달 25일에 월세", today));
		assertEquals(LocalDate.of(2026, 9, 5), RegexExpenseParser.parseDate("이번달 5일에 관리비", today)); // 명시일이라 미래여도 유지
		assertEquals(LocalDate.of(2026, 8, 31), RegexExpenseParser.parseDate("저번달 말일에 카드값", today));
		assertEquals(LocalDate.of(2026, 8, 12), RegexExpenseParser.parseDate("3주 전에 산 운동화", today));
	}

	@Test
	void parseDate_keepsExistingBehavior() {
		LocalDate today = LocalDate.of(2026, 9, 2);
		assertEquals(LocalDate.of(2026, 9, 1), RegexExpenseParser.parseDate("어제 저녁", today));
		assertEquals(LocalDate.of(2026, 8, 31), RegexExpenseParser.parseDate("그저께", today));
		assertEquals(LocalDate.of(2026, 8, 30), RegexExpenseParser.parseDate("그끄저께 마트", today));
		assertEquals(LocalDate.of(2026, 8, 25), RegexExpenseParser.parseDate("8월 25일 점심", today));
		assertEquals(today, RegexExpenseParser.parseDate("커피 한 잔", today));
	}
}
