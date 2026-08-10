// 히스토리 평균을 통한 다음 달 예측 함수
// 가중 선형회귀 방식은 데이터가 적을 때 이번 달 런레이트 추정치의 작은 흔들림에도
// 다음 달 예측이 크게 출렁였음 (백테스트 결과 MAPE 57% -> 평균 방식 전환 후 15.6%)
export const predictNextMonthExpense = (historyData) => {
  if (historyData.length === 0) return 0;

  const sum = historyData.reduce((acc, { amount }) => acc + amount, 0);
  return Math.max(0, Math.round(sum / historyData.length));
};

// 카테고리별 월간 지출 합계 — 거시 트렌드 분석(Gemini)에 보낼 데이터를 만든다.
// MonthlyTrendChart.jsx와 같은 월 범위 규칙(최대 6개월, 데이터만큼 동적으로 좁힘)을 재사용하되,
// 트렌드 분석은 1개월치만 있어도 "이번 달 구성" 코멘트로 대응 가능하므로 최소 1개월부터 반환한다
// (신규 유저를 위한 갭 메우기 — 2개월 미만이면 아예 분석을 못 받던 문제 해결).
export const getCategoryMonthlyTotals = (transactions, currentDate) => {
  const targetYear = currentDate.getFullYear();
  const targetMonth = currentDate.getMonth();

  const expenseTransactions = transactions.filter(
    (t) => (t.type?.toUpperCase() === 'OUT' || t.type?.toUpperCase() === 'EXPENSE') && t.excludeAnalysis !== 'Y'
  );
  if (expenseTransactions.length === 0) return [];

  const oldestDate = new Date(Math.min(...expenseTransactions.map((t) => new Date(t.date))));
  const monthDiff =
    (targetYear - oldestDate.getFullYear()) * 12 + (targetMonth - oldestDate.getMonth());
  const startMonthOffset = Math.min(Math.max(monthDiff, 0), 5);

  const monthKeys = [];
  for (let i = startMonthOffset; i >= 0; i--) {
    const d = new Date(targetYear, targetMonth - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const totals = {};
  monthKeys.forEach((key) => { totals[key] = {}; });

  expenseTransactions.forEach((t) => {
    const monthKey = t.date.substring(0, 7);
    if (!totals[monthKey]) return;
    const cat = t.category || '기타';
    totals[monthKey][cat] = (totals[monthKey][cat] || 0) + Math.abs(t.amount || t.originalAmount || 0);
  });

  return monthKeys
    .filter((key) => Object.keys(totals[key]).length > 0)
    .map((key) => ({ yearMonth: key, categories: totals[key] }));
};

// 이번 달 말 예상 지출 계산 함수
export const calculateProjectedExpense = (currentExpense, currentDate) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = currentDate.getDate();

  // 이번 달의 총 일수
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  if (today === 0) return currentExpense; // 1일 이전 예외처리

  // (현재지출 / 오늘날짜) * 총일수
  const projected = (currentExpense / today) * lastDayOfMonth;
  
  return Math.round(projected);
};

export default predictNextMonthExpense;