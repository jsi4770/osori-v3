package com.suin.fincoach.installment.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.suin.fincoach.installment.model.service.InstallmentService;
import com.suin.fincoach.installment.model.vo.InstallmentPlan;
import com.suin.fincoach.trans.model.vo.Mytrans;

@RestController
@RequestMapping("/trans/installment")
@CrossOrigin
public class InstallmentController {

	@Autowired
	private InstallmentService service;

	// 할부 등록: 총액을 N개월로 나눠 MYTRANS 행을 한 번에 생성 (자연어 입력/수기 입력 공통 진입점)
	@PostMapping("/register")
	public ResponseEntity<?> register(@RequestBody InstallmentPlan plan) {

		if (plan.getInstallmentMonths() < 2) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("할부는 2개월 이상부터 등록할 수 있습니다.");
		}
		if (plan.getTotalAmount() <= 0) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("금액이 올바르지 않습니다.");
		}
		if (plan.getStartDate() == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("시작일이 올바르지 않습니다.");
		}

		List<Mytrans> created = service.registerInstallment(plan);

		return ResponseEntity.status(HttpStatus.CREATED).body(created);
	}

}
