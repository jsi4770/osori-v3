package com.suin.fincoach.trans.dao;

import java.util.List;
import java.util.Map;

import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import com.suin.fincoach.fixedtrans.model.vo.FixedTrans;
import com.suin.fincoach.trans.model.vo.Mytrans;

@Repository
public class TransDao {

	public int myTransSave(SqlSessionTemplate sqlSession, Mytrans mt) {

		return sqlSession.insert("transMapper.myTransSave",mt);
	}

	public List<Mytrans> selectMyTrans(SqlSessionTemplate sqlSession, int userId) {
		return sqlSession.selectList("transMapper.selectMyTrans", userId);
	}

	public int updateTrans(SqlSessionTemplate sqlSession, Mytrans mt) {

		return sqlSession.update("transMapper.updateTrans",mt);
	}

	public int updateExcludeAnalysis(SqlSessionTemplate sqlSession, Mytrans mt) {

		return sqlSession.update("transMapper.updateExcludeAnalysis",mt);
	}

	public int deleteTrans(SqlSessionTemplate sqlSession, int transId) {

		return sqlSession.delete("transMapper.deleteTrans",transId);
	}

	// [추가] 고정지출 -> MYTRANS 자동반영 MERGE 실행 (원화 고정지출)
	public int mergeFixedToMyTrans(SqlSessionTemplate sqlSession) {
		return sqlSession.insert("transMapper.mergeFixedToMyTrans");
	}

	// 오늘이 결제일인 외화 고정지출 목록 (아직 이번 회차가 안 들어간 것만)
	public List<FixedTrans> selectDueForeignFixed(SqlSessionTemplate sqlSession) {
		return sqlSession.selectList("transMapper.selectDueForeignFixed");
	}

	// 외화 고정지출 1건을 오늘 환율로 환산해 MYTRANS에 등록
	public int insertFixedForeignToMyTrans(SqlSessionTemplate sqlSession, Map<String, Object> params) {
		return sqlSession.insert("transMapper.insertFixedForeignToMyTrans", params);
	}

	public List<Mytrans> recentTrans(SqlSessionTemplate sqlSession, int userId) {

		return sqlSession.selectList("transMapper.recentTrans",userId);
	}

}
