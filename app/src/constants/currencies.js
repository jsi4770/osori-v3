// 외화 입력 지원 통화. 서버 com.suin.fincoach.fx.model.vo.Currency 와 코드/기호를 맞춘다.
// 최종 저장은 항상 원화(KRW)이며, 외화 거래는 원본 금액/통화/적용 환율을 함께 스냅샷으로 저장한다.
export const CURRENCIES = [
  { code: "KRW", symbol: "₩", koName: "원", flag: "🇰🇷" },
  { code: "USD", symbol: "$", koName: "달러", flag: "🇺🇸" },
  { code: "JPY", symbol: "¥", koName: "엔", flag: "🇯🇵" },
  { code: "EUR", symbol: "€", koName: "유로", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", koName: "파운드", flag: "🇬🇧" },
  { code: "CNY", symbol: "元", koName: "위안", flag: "🇨🇳" },
  { code: "TWD", symbol: "NT$", koName: "대만달러", flag: "🇹🇼" },
];

export const DEFAULT_CURRENCY = "KRW";

export const currencyMeta = (code) =>
  CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

export const isForeign = (code) => !!code && code !== "KRW";

// 환율 소스 라벨(디버그/툴팁용). stale(추정)이면 UI가 별도로 표시한다.
export const fxSourceLabel = (source) => {
  switch (source) {
    case "eximbank":
      return "한국수출입은행 고시";
    case "erapi":
      return "실시간 참고환율";
    case "manual":
      return "직접 입력";
    case "fallback":
      return "근사 환율(추정)";
    default:
      return "";
  }
};
