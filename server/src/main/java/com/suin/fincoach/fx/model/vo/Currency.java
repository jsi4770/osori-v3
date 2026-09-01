package com.suin.fincoach.fx.model.vo;

// 앱이 지원하는 통화 목록(원화 + 외화 6종). 프론트 app/src/constants/currencies.js와 코드/기호를 맞춘다.
// eximUnit: 한국수출입은행 환율 API(AP01)의 cur_unit 값. null이면 수은이 고시하지 않는 통화(TWD)라
//           open.er-api.com 교차환율로만 조회한다.
// eximDivisor: 수은이 100단위로 고시하는 통화(JPY: "JPY(100)") 보정용 제수. 나머지는 1.
public enum Currency {

	KRW("원", "₩", "🇰🇷", null, 1),
	USD("달러", "$", "🇺🇸", "USD", 1),
	JPY("엔", "¥", "🇯🇵", "JPY(100)", 100),
	EUR("유로", "€", "🇪🇺", "EUR", 1),
	GBP("파운드", "£", "🇬🇧", "GBP", 1),
	CNY("위안", "元", "🇨🇳", "CNH", 1),
	TWD("대만달러", "NT$", "🇹🇼", null, 1);

	public final String koName;
	public final String symbol;
	public final String flag;
	public final String eximUnit;
	public final int eximDivisor;

	Currency(String koName, String symbol, String flag, String eximUnit, int eximDivisor) {
		this.koName = koName;
		this.symbol = symbol;
		this.flag = flag;
		this.eximUnit = eximUnit;
		this.eximDivisor = eximDivisor;
	}

	// 알 수 없는/빈 코드는 KRW로 폴백한다(외화 기능이 꺼진 클라이언트나 잘못된 입력도 원화로 안전하게 처리).
	public static Currency of(String code) {
		if (code == null) {
			return KRW;
		}
		try {
			return Currency.valueOf(code.trim().toUpperCase());
		} catch (IllegalArgumentException e) {
			return KRW;
		}
	}

	public static boolean isSupported(String code) {
		if (code == null || code.isBlank()) {
			return false;
		}
		try {
			Currency.valueOf(code.trim().toUpperCase());
			return true;
		} catch (IllegalArgumentException e) {
			return false;
		}
	}
}
