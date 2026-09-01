package com.suin.fincoach.nlparse.util;

import java.time.LocalDate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// LLM 없이도(장애/타임아웃 시) 최소한의 정보는 건질 수 있는 정규식 기반 폴백 파서.
// 또한 LLM이 뽑은 금액을 검증하는 이중 체크용으로도 재사용한다("15000원"을 150000으로
// 잘못 읽는 자릿수 오류 등을 정규식 결과로 덮어써 방지).
public class RegexExpenseParser {

	private static final Pattern MAN_PATTERN =
			Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*만\\s*(?:(\\d+)\\s*천)?\\s*원?");
	private static final Pattern CHEON_PATTERN = Pattern.compile("(\\d+)\\s*천\\s*원?");
	private static final Pattern WON_PATTERN = Pattern.compile("([\\d,]+)\\s*원");
	private static final Pattern BARE_COMMA_PATTERN = Pattern.compile("\\d{1,3}(?:,\\d{3})+");

	private static final Pattern D_AGO_PATTERN = Pattern.compile("(\\d+)\\s*일\\s*전");
	private static final Pattern ISO_DATE_PATTERN =
			Pattern.compile("(20\\d{2})[.\\-/년]\\s*(\\d{1,2})[.\\-/월]\\s*(\\d{1,2})");
	private static final Pattern MONTH_DAY_PATTERN = Pattern.compile("(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일");

	private static final Pattern INSTALLMENT_PATTERN_A = Pattern.compile("(\\d+)\\s*개월\\s*할부");
	private static final Pattern INSTALLMENT_PATTERN_B = Pattern.compile("할부\\s*(\\d+)\\s*개월");
	// "할부"라는 단어 없이 "50000원 2개월"처럼 금액 바로 뒤에 개월수만 오는 구어체 표현도 할부로 인식한다.
	// "원" 바로 뒤(공백만 허용)에 와야 하므로 "...30000원, 지난 2개월간"처럼 다른 말이 끼어 있으면 매칭되지 않고,
	// "2개월치"/"2개월간"처럼 기간을 뜻하는 조사가 바로 붙으면(negative lookahead) 할부로 오인하지 않는다.
	private static final Pattern INSTALLMENT_PATTERN_C =
			Pattern.compile("원\\s*(\\d+)\\s*개월(?!\\s*(?:동안|간|치|전|후|째|만))");

	// 외화: 숫자에 바로 붙은 통화 기호/단어를 잡는다. "$30", "30달러", "1,500엔", "12.5 파운드", "€20".
	// 반드시 숫자와 인접해야 하므로 "이번엔", "엔진" 같은 오탐을 피한다.
	private static final Pattern FX_NUM_THEN_UNIT = Pattern.compile(
			"([\\d,]+(?:\\.\\d+)?)\\s*(달러|불|USD|엔화|엔|JPY|\\u00A5|유로|EUR|\\u20AC|파운드|GBP|\\u00A3|위안|\\u5143|CNY|RMB|대만\\s*달러|TWD|NT\\$|\\$)",
			Pattern.CASE_INSENSITIVE);
	private static final Pattern FX_UNIT_THEN_NUM = Pattern.compile(
			"(NT\\$|\\$|\\u00A3|\\u20AC|\\u00A5|USD|EUR|GBP|JPY|CNY)\\s*([\\d,]+(?:\\.\\d+)?)",
			Pattern.CASE_INSENSITIVE);

	private RegexExpenseParser() {}

	// 텍스트에서 원 단위 금액을 추출. 못 찾으면 null.
	public static Integer parseAmount(String text) {
		if (text == null || text.isBlank()) return null;

		Matcher man = MAN_PATTERN.matcher(text);
		if (man.find()) {
			double manValue = Double.parseDouble(man.group(1));
			int cheonPart = man.group(2) != null ? Integer.parseInt(man.group(2)) * 1000 : 0;
			return (int) Math.round(manValue * 10000) + cheonPart;
		}

		Matcher cheon = CHEON_PATTERN.matcher(text);
		if (cheon.find()) {
			return Integer.parseInt(cheon.group(1)) * 1000;
		}

		Matcher won = WON_PATTERN.matcher(text);
		if (won.find()) {
			try {
				return Integer.parseInt(won.group(1).replace(",", ""));
			} catch (NumberFormatException ignored) {
				// fall through
			}
		}

		Matcher bare = BARE_COMMA_PATTERN.matcher(text);
		if (bare.find()) {
			return Integer.parseInt(bare.group().replace(",", ""));
		}

		return null;
	}

	// 텍스트에 외화 단위가 숫자에 붙어 있으면 통화 코드(USD/JPY/EUR/GBP/CNY/TWD)를, 없으면 null(=원화).
	public static String parseCurrency(String text) {
		String unit = matchedUnit(text);
		return unit == null ? null : unitToCode(unit);
	}

	// 외화 단위에 인접한 숫자 금액(정수로 반올림). 통화가 안 붙어 있으면 null.
	public static Integer parseForeignAmount(String text) {
		if (text == null) {
			return null;
		}
		Matcher a = FX_NUM_THEN_UNIT.matcher(text);
		if (a.find()) {
			return looseInt(a.group(1));
		}
		Matcher b = FX_UNIT_THEN_NUM.matcher(text);
		if (b.find()) {
			return looseInt(b.group(2));
		}
		return null;
	}

	private static String matchedUnit(String text) {
		if (text == null || text.isBlank()) {
			return null;
		}
		Matcher a = FX_NUM_THEN_UNIT.matcher(text);
		if (a.find()) {
			return a.group(2);
		}
		Matcher b = FX_UNIT_THEN_NUM.matcher(text);
		if (b.find()) {
			return b.group(1);
		}
		return null;
	}

	private static String unitToCode(String unit) {
		String u = unit.toLowerCase().replace(" ", "");
		if (u.contains("대만") || u.equals("nt$") || u.equals("twd")) {
			return "TWD";
		}
		if (u.contains("달러") || u.contains("불") || u.equals("$") || u.equals("usd")) {
			return "USD";
		}
		if (u.contains("엔") || u.equals("jpy") || u.equals("¥")) {
			return "JPY";
		}
		if (u.contains("유로") || u.equals("eur") || u.equals("€")) {
			return "EUR";
		}
		if (u.contains("파운드") || u.equals("gbp") || u.equals("£")) {
			return "GBP";
		}
		if (u.contains("위안") || u.equals("元") || u.equals("cny") || u.equals("rmb")) {
			return "CNY";
		}
		return null;
	}

	private static Integer looseInt(String s) {
		try {
			return (int) Math.round(Double.parseDouble(s.replace(",", "")));
		} catch (Exception e) {
			return null;
		}
	}

	// 텍스트에서 "3개월 할부"/"할부 3개월" 같은 할부 개월수를 추출. 없으면(=일시불) null.
	public static Integer parseInstallmentMonths(String text) {
		if (text == null || text.isBlank()) return null;

		Matcher a = INSTALLMENT_PATTERN_A.matcher(text);
		if (a.find()) {
			return Integer.parseInt(a.group(1));
		}

		Matcher b = INSTALLMENT_PATTERN_B.matcher(text);
		if (b.find()) {
			return Integer.parseInt(b.group(1));
		}

		Matcher c = INSTALLMENT_PATTERN_C.matcher(text);
		if (c.find()) {
			return Integer.parseInt(c.group(1));
		}

		return null;
	}

	// 텍스트에서 상대/절대 날짜 표현을 오늘(today) 기준으로 해석. 못 찾으면 오늘.
	// 미래 날짜로 풀리면(예: 오타·모호한 표현) 오늘로 clamp — 앱 전체가 미래 지출 등록을 막는 정책과 동일하게 맞춘다.
	public static LocalDate parseDate(String text, LocalDate today) {
		LocalDate resolved = resolve(text, today);
		return resolved.isAfter(today) ? today : resolved;
	}

	private static LocalDate resolve(String text, LocalDate today) {
		if (text == null || text.isBlank()) return today;
		if (text.contains("오늘")) return today;
		if (text.contains("어제")) return today.minusDays(1);
		if (text.contains("그저께") || text.contains("그제")) return today.minusDays(2);

		Matcher dAgo = D_AGO_PATTERN.matcher(text);
		if (dAgo.find()) {
			return today.minusDays(Long.parseLong(dAgo.group(1)));
		}

		Matcher iso = ISO_DATE_PATTERN.matcher(text);
		if (iso.find()) {
			try {
				return LocalDate.of(
						Integer.parseInt(iso.group(1)), Integer.parseInt(iso.group(2)), Integer.parseInt(iso.group(3)));
			} catch (Exception ignored) {
				// fall through
			}
		}

		Matcher md = MONTH_DAY_PATTERN.matcher(text);
		if (md.find()) {
			try {
				LocalDate candidate =
						LocalDate.of(today.getYear(), Integer.parseInt(md.group(1)), Integer.parseInt(md.group(2)));
				return candidate.isAfter(today) ? candidate.minusYears(1) : candidate;
			} catch (Exception ignored) {
				// fall through
			}
		}

		return today;
	}

}
