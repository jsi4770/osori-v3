package com.suin.fincoach.installment.model.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.suin.fincoach.installment.model.dao.InstallmentDao;
import com.suin.fincoach.installment.model.vo.InstallmentPlan;
import com.suin.fincoach.trans.dao.TransDao;
import com.suin.fincoach.trans.model.vo.Mytrans;

@Service
public class InstallmentServiceImpl implements InstallmentService {

	@Autowired
	private InstallmentDao dao;

	@Autowired
	private TransDao transDao;

	@Autowired
	private SqlSessionTemplate sqlSession;

	@Transactional
	@Override
	public List<Mytrans> registerInstallment(InstallmentPlan plan) {

		dao.insertPlan(sqlSession, plan); // useGeneratedKeys로 plan.planId가 채워짐

		int months = plan.getInstallmentMonths();
		int baseAmount = plan.getTotalAmount() / months;
		int remainder = plan.getTotalAmount() - (baseAmount * months); // 나머지는 마지막 회차에 몰아서 붙여 합계를 정확히 맞춤

		LocalDate startDate = plan.getStartDate();
		int baseDay = startDate.getDayOfMonth();

		List<Mytrans> created = new ArrayList<>();

		for (int i = 0; i < months; i++) {

			YearMonth targetMonth = YearMonth.from(startDate).plusMonths(i);
			int occDay = Math.min(baseDay, targetMonth.lengthOfMonth()); // 말일 clamp — FixedTrans 스케줄러와 동일한 규칙
			LocalDate occDate = targetMonth.atDay(occDay);

			int amount = (i == months - 1) ? baseAmount + remainder : baseAmount;

			Mytrans mt = Mytrans.builder()
					.title(plan.getTitle() + " (" + (i + 1) + "/" + months + ")")
					.transDate(occDate)
					.originalAmount(amount)
					.isShared("N")
					.category(plan.getCategory())
					.type("OUT")
					.memo(plan.getMemo())
					.userId(plan.getUserId())
					.excludeAnalysis("N")
					.installmentId(plan.getPlanId())
					.build();

			transDao.myTransSave(sqlSession, mt);
			created.add(mt);
		}

		return created;
	}

}
