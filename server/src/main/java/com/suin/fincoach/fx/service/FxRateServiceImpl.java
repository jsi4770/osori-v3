package com.suin.fincoach.fx.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.suin.fincoach.fx.model.dao.FxRateDao;
import com.suin.fincoach.fx.model.vo.Currency;
import com.suin.fincoach.fx.model.vo.FxRate;
import com.suin.fincoach.fx.model.vo.FxRateResult;

import lombok.extern.slf4j.Slf4j;

// 환율 해석. 우선순위: DB 캐시 -> 한국수출입은행(과거 영업일 역행) -> open.er-api.com 교차환율 -> 하드코딩 폴백.
// 모든 원격 소스는 무료지만, 남용 방지를 위해 하루 호출 수에 상한(fx.daily-limit)을 둔다.
// 과거 환율은 한 번 조회하면 불변이므로 영구 캐싱하고, 당일 환율만 TTL로 갱신한다.
@Service
@Slf4j
public class FxRateServiceImpl implements FxRateService {

	@Autowired
	private SqlSessionTemplate sqlSession;

	@Autowired
	private FxRateDao fxRateDao;

	@Value("${fx.enabled:false}")
	private boolean fxEnabled;

	@Value("${fx.eximbank.key:CHANGE_ME}")
	private String eximKey;

	@Value("${fx.daily-limit:300}")
	private int dailyLimit;

	// 모든 원격 소스 실패 시 최후 폴백(KRW per 1 unit). 대략적인 값이며 properties로 덮어쓸 수 있다.
	@Value("${fx.fallback.USD:1360}")
	private double fbUsd;
	@Value("${fx.fallback.JPY:9.1}")
	private double fbJpy;
	@Value("${fx.fallback.EUR:1470}")
	private double fbEur;
	@Value("${fx.fallback.GBP:1730}")
	private double fbGbp;
	@Value("${fx.fallback.CNY:189}")
	private double fbCny;
	@Value("${fx.fallback.TWD:42}")
	private double fbTwd;

	private static final ZoneId KST = ZoneId.of("Asia/Seoul");
	private static final String EXIM_URL =
			"https://www.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=%s&searchdate=%s&data=AP01";
	private static final String ERAPI_URL = "https://open.er-api.com/v6/latest/USD";
	private static final int MAX_BACKTRACK_DAYS = 10;
	private static final long TODAY_TTL_MINUTES = 360; // 당일 환율 재조회 간격(6시간)

	private final RestTemplate restTemplate = new RestTemplate();
	private final JSONParser jsonParser = new JSONParser();

	// 일일 원격 호출 카운터. 메모리 기반이고 자정(KST)을 넘으면 리셋 — 정확한 회계용이 아니라
	// "폭주 방지" 목적이라 재시작 시 초기화돼도 무방하다.
	private LocalDate callCountDate = LocalDate.now(KST);
	private int callCount = 0;

	@Override
	public FxRateResult getRate(String currencyCode, LocalDate date) {
		Currency cur = Currency.of(currencyCode);
		LocalDate today = LocalDate.now(KST);
		if (date == null || date.isAfter(today)) {
			date = today;
		}

		if (cur == Currency.KRW) {
			return FxRateResult.builder()
					.currency("KRW").rate(BigDecimal.ONE).rateDate(date)
					.source("krw").stale(false).build();
		}

		// 1) 캐시 히트(신선하면 그대로)
		FxRate cached = fxRateDao.selectRate(sqlSession, cur.name(), date);
		if (cached != null && isFresh(cached, date, today)) {
			return FxRateResult.builder()
					.currency(cur.name()).rate(cached.getRate()).rateDate(date)
					.source(cached.getSource()).stale("fallback".equals(cached.getSource())).build();
		}

		// 2) 원격 조회(기능 on + 호출 한도 이내)
		if (fxEnabled && allowRemoteCall()) {
			FxRateResult remote = fetchRemote(cur, date, today);
			if (remote != null) {
				fxRateDao.upsertRate(sqlSession, FxRate.builder()
						.currency(cur.name()).rateDate(date)
						.rate(remote.getRate()).source(remote.getSource()).build());
				return remote;
			}
		}

		// 3) 원격 실패했지만 만료된 캐시라도 있으면 그것(stale 표시)
		if (cached != null) {
			return FxRateResult.builder()
					.currency(cur.name()).rate(cached.getRate()).rateDate(date)
					.source(cached.getSource()).stale(true).build();
		}

		// 4) 하드코딩 폴백
		return FxRateResult.builder()
				.currency(cur.name()).rate(BigDecimal.valueOf(fallbackRate(cur)))
				.rateDate(date).source("fallback").stale(true).build();
	}

	private boolean isFresh(FxRate cached, LocalDate requestedDate, LocalDate today) {
		if ("fallback".equals(cached.getSource())) {
			return false; // 폴백 캐시는 항상 정식 값으로 재시도
		}
		if (requestedDate.isBefore(today)) {
			return true; // 과거 환율은 불변
		}
		if (cached.getFetchedAt() == null) {
			return false;
		}
		return Duration.between(cached.getFetchedAt(), LocalDateTime.now(KST)).toMinutes() < TODAY_TTL_MINUTES;
	}

	private FxRateResult fetchRemote(Currency cur, LocalDate date, LocalDate today) {
		// (a) 한국수출입은행: 요청일부터 직전 영업일로 최대 MAX_BACKTRACK_DAYS 역행하며 조회
		if (cur.eximUnit != null && eximKey != null && !eximKey.isBlank() && !"CHANGE_ME".equals(eximKey)) {
			LocalDate d = date;
			for (int i = 0; i < MAX_BACKTRACK_DAYS; i++) {
				BigDecimal r = fetchEximbank(cur, d);
				if (r != null) {
					return FxRateResult.builder()
							.currency(cur.name()).rate(r).rateDate(d)
							.source("eximbank").stale(false).build();
				}
				d = d.minusDays(1);
			}
		}

		// (b) open.er-api.com 교차환율(KRW per 1 unit = rates.KRW / rates.<cur>).
		//     "최신" 값만 제공하므로 과거 날짜 요청이면 근사치(stale)로 표시한다.
		//     수은이 고시하지 않는 TWD의 유일한 무료 소스이기도 하다.
		BigDecimal r = fetchErApi(cur);
		if (r != null) {
			boolean approx = date.isBefore(today);
			return FxRateResult.builder()
					.currency(cur.name()).rate(r).rateDate(approx ? date : today)
					.source("erapi").stale(approx).build();
		}
		return null;
	}

	private BigDecimal fetchEximbank(Currency cur, LocalDate d) {
		try {
			countCall();
			String url = String.format(EXIM_URL, eximKey, d.format(DateTimeFormatter.BASIC_ISO_DATE));
			String body = restTemplate.getForObject(url, String.class);
			if (body == null || body.isBlank()) {
				return null;
			}
			Object parsed = jsonParser.parse(body);
			if (!(parsed instanceof JSONArray)) {
				return null;
			}
			for (Object o : (JSONArray) parsed) {
				JSONObject row = (JSONObject) o;
				if (!cur.eximUnit.equals(String.valueOf(row.get("cur_unit")))) {
					continue;
				}
				if (!"1".equals(String.valueOf(row.get("result")))) {
					return null;
				}
				String raw = String.valueOf(row.get("deal_bas_r")).replace(",", "").trim();
				if (raw.isEmpty() || "null".equals(raw)) {
					return null;
				}
				return new BigDecimal(raw).divide(BigDecimal.valueOf(cur.eximDivisor), 4, RoundingMode.HALF_UP);
			}
		} catch (Exception e) {
			log.warn("수출입은행 환율 조회 실패 {} {}: {}", cur, d, e.getMessage());
		}
		return null;
	}

	private BigDecimal fetchErApi(Currency cur) {
		try {
			countCall();
			String body = restTemplate.getForObject(ERAPI_URL, String.class);
			if (body == null) {
				return null;
			}
			JSONObject root = (JSONObject) jsonParser.parse(body);
			if (!"success".equals(root.get("result"))) {
				return null;
			}
			JSONObject rates = (JSONObject) root.get("rates");
			if (rates == null) {
				return null;
			}
			double krwPerUsd = toDouble(rates.get("KRW"));
			double curPerUsd = cur == Currency.USD ? 1.0 : toDouble(rates.get(cur.name()));
			if (krwPerUsd <= 0 || curPerUsd <= 0) {
				return null;
			}
			return BigDecimal.valueOf(krwPerUsd / curPerUsd).setScale(4, RoundingMode.HALF_UP);
		} catch (Exception e) {
			log.warn("er-api 환율 조회 실패 {}: {}", cur, e.getMessage());
		}
		return null;
	}

	private double fallbackRate(Currency cur) {
		switch (cur) {
		case USD:
			return fbUsd;
		case JPY:
			return fbJpy;
		case EUR:
			return fbEur;
		case GBP:
			return fbGbp;
		case CNY:
			return fbCny;
		case TWD:
			return fbTwd;
		default:
			return 1.0;
		}
	}

	private synchronized boolean allowRemoteCall() {
		rollCounter();
		return callCount < dailyLimit;
	}

	private synchronized void countCall() {
		rollCounter();
		callCount++;
	}

	private void rollCounter() {
		LocalDate today = LocalDate.now(KST);
		if (!today.equals(callCountDate)) {
			callCountDate = today;
			callCount = 0;
		}
	}

	private double toDouble(Object v) {
		if (v instanceof Number) {
			return ((Number) v).doubleValue();
		}
		try {
			return Double.parseDouble(String.valueOf(v).trim());
		} catch (Exception e) {
			return 0d;
		}
	}

	@Override
	public List<Map<String, Object>> supportedCurrencies() {
		List<Map<String, Object>> list = new ArrayList<>();
		for (Currency c : Currency.values()) {
			Map<String, Object> m = new LinkedHashMap<>();
			m.put("code", c.name());
			m.put("koName", c.koName);
			m.put("symbol", c.symbol);
			m.put("flag", c.flag);
			list.add(m);
		}
		return list;
	}

	@Override
	public boolean isSupported(String currency) {
		return Currency.isSupported(currency);
	}
}
