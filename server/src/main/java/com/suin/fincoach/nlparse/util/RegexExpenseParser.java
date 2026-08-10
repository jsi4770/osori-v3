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
