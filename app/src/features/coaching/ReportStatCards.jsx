import React, { useMemo } from 'react';

// 이번 달 총지출 / 일평균 지출 / 전월 대비 증감률 — 리포트 탭 최상단 요약.
// 지출은 늘어나면 나쁜 신호라 증감률 색은 상승=expense-color(빨강), 하락=income-color(초록)로
// 앱 전역에서 지출/수입에 쓰는 색 의미를 그대로 따른다.
function ReportStatCards({ transactions = [], currentDate }) {
  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const isExpense = (t) => t.type?.toUpperCase() === 'OUT' && t.excludeAnalysis !== 'Y' && (!t.date || t.date <= todayStr);

    const curYM = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    let curTotal = 0;
    let prevTotal = 0;
    transactions.filter(isExpense).forEach((t) => {
      const amt = Math.abs(t.amount || 0);
      if (t.date?.startsWith(curYM)) curTotal += amt;
      else if (t.date?.startsWith(prevYM)) prevTotal += amt;
    });

    const today = new Date();
    const isCurrentMonth = curYM === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const daysElapsed = isCurrentMonth
      ? today.getDate()
      : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const dailyAvg = daysElapsed > 0 ? Math.round(curTotal / daysElapsed) : 0;

    const changePct = prevTotal > 0 ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : null;

    return { curTotal, dailyAvg, changePct };
  }, [transactions, currentDate]);

  const changeText = stats.changePct === null ? '-' : `${stats.changePct > 0 ? '+' : ''}${stats.changePct}%`;
  const changeClass = stats.changePct === null ? '' : stats.changePct > 0 ? 'is-up' : stats.changePct < 0 ? 'is-down' : '';

  return (
    <div className="report-stat-row">
      <div className="report-stat-card">
        <span className="report-stat-label">이번 달 총지출</span>
        <span className="report-stat-value">{stats.curTotal.toLocaleString()}원</span>
      </div>
      <div className="report-stat-card">
        <span className="report-stat-label">일평균 지출</span>
        <span className="report-stat-value">{stats.dailyAvg.toLocaleString()}원</span>
      </div>
      <div className="report-stat-card">
        <span className="report-stat-label">전월 대비</span>
        <span className={`report-stat-value ${changeClass}`}>{changeText}</span>
      </div>
    </div>
  );
}

export default ReportStatCards;
