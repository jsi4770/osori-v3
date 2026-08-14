package com.suin.fincoach.installment.model.service;

import java.util.List;

import com.suin.fincoach.installment.model.vo.InstallmentPlan;
import com.suin.fincoach.trans.model.vo.Mytrans;

public interface InstallmentService {

	public List<Mytrans> registerInstallment(InstallmentPlan plan);

}
