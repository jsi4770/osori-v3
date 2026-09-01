package com.suin.fincoach.fx.controller;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.suin.fincoach.fx.model.vo.FxRateResult;
import com.suin.fincoach.fx.service.FxRateService;

import lombok.extern.slf4j.Slf4j;

// 수기/자연어 입력 화면의 "환산 미리보기"에 쓰는 조회 전용 엔드포인트.
@RestController
@RequestMapping("/fx")
@CrossOrigin
@Slf4j
public class FxController {

	@Autowired
	private FxRateService fxRateService;

	@GetMapping("/currencies")
	public ResponseEntity<?> currencies() {
		return ResponseEntity.ok(fxRateService.supportedCurrencies());
	}

	// GET /fx/rate?currency=GBP&date=2026-08-10  (date 생략 시 오늘 KST)
	@GetMapping("/rate")
	public ResponseEntity<?> rate(@RequestParam String currency,
			@RequestParam(required = false) String date) {
		LocalDate d = null;
		if (date != null && !date.isBlank()) {
			try {
				d = LocalDate.parse(date.trim());
			} catch (Exception ignored) {
				// 잘못된 날짜 형식이면 오늘 기준으로 처리
			}
		}
		FxRateResult r = fxRateService.getRate(currency, d);
		Map<String, Object> out = new LinkedHashMap<>();
		out.put("currency", r.getCurrency());
		out.put("rate", r.getRate());
		out.put("rateDate", r.getRateDate() == null ? null : r.getRateDate().toString());
		out.put("source", r.getSource());
		out.put("stale", r.isStale());
		return ResponseEntity.ok(out);
	}
}
