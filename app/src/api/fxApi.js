import api from "./axios";

// 환율 조회(조회 전용). 수기/자연어 입력의 "환산 미리보기"에 쓴다.
export const fxApi = {
  // currency: "USD" 등, date: "yyyy-MM-dd"(생략 시 서버가 오늘 KST 사용)
  // 반환: { currency, rate, rateDate, source, stale }  (rate = KRW per 1 unit)
  rate: async (currency, date) => {
    const params = { currency };
    if (date) params.date = date;
    const res = await api.get("/fx/rate", { params });
    return res.data;
  },

  currencies: async () => {
    const res = await api.get("/fx/currencies");
    return res.data;
  },
};

export default fxApi;
