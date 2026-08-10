package com.suin.fincoach.nlparse.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.suin.fincoach.coaching.model.service.GeminiCallBudget;
import com.suin.fincoach.nlparse.model.service.NlExpenseParseService;

@RestController
@RequestMapping("/nlparse")
@CrossOrigin
public class NlExpenseParseController {

	@Autowired
	private NlExpenseParseService service;

	// Gemini 실호출 엔드포인트라 코칭/챌린지와 동일한 공유 일일 캡을 적용한다(구글 할당량이
	// 프로젝트+모델 단위라서 컨트롤러마다 따로 세면 실제 한도를 못 지킨다).
	@Autowired
	private GeminiCallBudget geminiCallBudget;

	@Value("${coaching.llm.enabled:false}")
	private boolean llmEnabled;

	@Value("${coaching.llm.daily-limit:50}")
	private int dailyLimit;

	@PostMapping("/parse")
	public ResponseEntity<?> parse(@RequestBody Map<String, Object> body) {
		if (llmEnabled && geminiCallBudget.incrementAndGetTodayCalls() > dailyLimit) {
			return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
					.body(Map.of("message", "오늘의 AI 호출 한도(" + dailyLimit + "회)를 초과했습니다. 잠시 후 다시 시도해주세요."));
		}

		int userId = toInt(body.get("userId"));
		String text = body.get("text") == null ? null : String.valueOf(body.get("text")).trim();
		String type = body.get("type") == null ? "OUT" : String.valueOf(body.get("type"));

		if (text == null || text.isBlank()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body(Map.of("ok", false, "errorReason", "EMPTY_TEXT", "message", "입력이 비어 있습니다."));
		}

		return ResponseEntity.ok(service.parse(userId, text, type));
	}

	// 사용자가 저장(자동/확인 후)한 merchant -> category, 그리고 원문 문장(text)을 학습에 반영.
	// LLM을 호출하지 않으므로 일일 캡을 소모하지 않는다.
	@PostMapping("/learn")
	public ResponseEntity<?> learn(@RequestBody Map<String, Object> body) {
		int userId = toInt(body.get("userId"));
		String merchant = body.get("merchant") == null ? null : String.valueOf(body.get("merchant"));
		String category = body.get("category") == null ? null : String.valueOf(body.get("category"));
		String type = body.get("type") == null ? "OUT" : String.valueOf(body.get("type"));
		String text = body.get("text") == null ? null : String.valueOf(body.get("text"));

		service.learn(userId, merchant, category, type, text);
		return ResponseEntity.ok(Map.of("ok", true));
	}

	// 빠른 입력창 아래 예시 칩 개인화 — 이 사용자가 자주/최근에 쓴 문장. LLM을 호출하지 않는다.
	@GetMapping("/examples")
	public ResponseEntity<?> examples(@RequestParam int userId, @RequestParam(defaultValue = "OUT") String type) {
		List<String> examples = service.getExamples(userId, type);
		return ResponseEntity.ok(Map.of("examples", examples));
	}

	private int toInt(Object value) {
		if (value == null) return 0;
		if (value instanceof Number) return ((Number) value).intValue();
		try {
			return Integer.parseInt(String.valueOf(value).trim());
		} catch (NumberFormatException e) {
			return 0;
		}
	}

}
