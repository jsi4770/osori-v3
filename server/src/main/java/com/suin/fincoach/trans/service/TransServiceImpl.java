package com.suin.fincoach.trans.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.suin.fincoach.fixedtrans.model.vo.FixedTrans;
import com.suin.fincoach.fx.model.vo.FxRateResult;
import com.suin.fincoach.fx.service.FxRateService;
import com.suin.fincoach.trans.dao.TransDao;
import com.suin.fincoach.trans.model.vo.Mytrans;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class TransServiceImpl implements TransService{

	@Autowired
	private TransDao dao;

	@Autowired
	private SqlSessionTemplate sqlSession;

	@Autowired
	private FxRateService fxRateService;

	private static final ZoneId KST = ZoneId.of("Asia/Seoul");

	@Override
	public int myTransSave(Mytrans mt) {

		applyFx(mt);
		return dao.myTransSave(sqlSession,mt);

	}

	@Override
	public List<Mytrans> getMyTransactions(int userId) {
		return dao.selectMyTrans(sqlSession, userId);
	}

	@Override
	public int updateTrans(Mytrans mt) {

		applyFx(mt);
		return dao.updateTrans(sqlSession,mt);
	}

	@Override
	public int updateExcludeAnalysis(Mytrans mt) {

		return dao.updateExcludeAnalysis(sqlSession,mt);
	}

	@Override
	public int deleteTrans(int transId) {

		return dao.deleteTrans(sqlSession,transId);
	}

	// [추가] 고정지출 -> MYTRANS 자동반영. 원화는 SQL MERGE 한 방, 외화는 결제일(오늘) 환율로 건별 재환산.
	@Override
	public int mergeFixedToMyTrans() {
	  int krwRows = dao.mergeFixedToMyTrans(sqlSession);
	  int fxRows = mergeForeignFixedToMyTrans();
	  return krwRows + fxRows;
	}

	// 외화 고정지출은 환율을 고정하지 않고, 이번 회차가 등록되는 시점(결제일=오늘) 환율로 원화 환산해 넣는다.
	private int mergeForeignFixedToMyTrans() {
		List<FixedTrans> due = dao.selectDueForeignFixed(sqlSession);
		if (due == null || due.isEmpty()) {
			return 0;
		}
		LocalDate today = LocalDate.now(KST);
		int inserted = 0;
		for (FixedTrans f : due) {
			try {
				String cur = f.getCurrency().trim().toUpperCase();
				FxRateResult fx = fxRateService.getRate(cur, today);
				int krw = fx.toKrw(f.getFxAmount());
				if (krw <= 0) {
					continue;
				}
				Map<String, Object> p = new HashMap<>();
				p.put("name", f.getName());
				p.put("category", f.getCategory());
				p.put("userId", f.getUserId());
				p.put("fixedId", f.getFixedId());
				p.put("krw", krw);
				p.put("currency", cur);
				p.put("fxAmount", f.getFxAmount());
				p.put("fxRate", fx.getRate());
				p.put("fxRateDate", fx.getRateDate());
				p.put("fxRateSource", fx.getSource());
				inserted += dao.insertFixedForeignToMyTrans(sqlSession, p);
			} catch (Exception e) {
				log.warn("외화 고정지출 자동등록 실패 fixedId={}: {}", f.getFixedId(), e.getMessage());
			}
		}
		return inserted;
	}

	@Override
	public List<Mytrans> recentTrans(int userId) {

		return dao.recentTrans(sqlSession,userId);
	}

	// 외화 거래면 거래일 기준 환율로 원화(ORIGINAL_AMOUNT)를 확정하고 환율 스냅샷(fx*)을 채운다.
	// - currency가 없거나 KRW, 또는 외화 금액(fxAmount)이 없으면 순수 원화 거래로 정규화한다.
	// - krwOverride=true면(사용자가 명세서 보고 원화값 직접 지정) originalAmount는 건드리지 않고
	//   환율 정보는 참고용으로 남긴다(source="manual").
	private void applyFx(Mytrans mt) {
		String cur = mt.getCurrency() == null ? "KRW" : mt.getCurrency().trim().toUpperCase();
		boolean foreign = !cur.isEmpty() && !"KRW".equals(cur)
				&& fxRateService.isSupported(cur)
				&& mt.getFxAmount() != null && mt.getFxAmount().signum() > 0;

		if (!foreign) {
			mt.setCurrency("KRW");
			mt.setFxAmount(null);
			mt.setFxRate(null);
			mt.setFxRateDate(null);
			mt.setFxRateSource(null);
			return;
		}

		LocalDate rateOn = mt.getTransDate() != null ? mt.getTransDate() : LocalDate.now(KST);
		FxRateResult fx = fxRateService.getRate(cur, rateOn);

		mt.setCurrency(cur);
		mt.setFxRate(fx.getRate());
		mt.setFxRateDate(fx.getRateDate());

		boolean override = Boolean.TRUE.equals(mt.getKrwOverride()) && mt.getOriginalAmount() > 0;
		mt.setFxRateSource(override ? "manual" : fx.getSource());
		if (!override) {
			mt.setOriginalAmount(fx.toKrw(mt.getFxAmount()));
		}
	}

}
