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

  // 할부로 미리 생성된 미래 회차(아직 실제로 지출되지 않음)는 월간 합계 및 Gemini 트렌드 분석 입력에서 제외한다.
  const todayStr = new Date().toLocaleDateString('en-CA');
  const expenseTransactions = transactions.filter(
    (t) =>
      (t.type?.toUpperCase() === 'OUT' || t.type?.toUpperCase() === 'EXPENSE') &&
      t.excludeAnalysis !== 'Y' &&
      (!t.date || t.date <= todayStr)
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

// 백엔드 트랜잭션 원본(camelCase/UPPER_SNAKE 혼재, transDate가 "YY/MM/DD" 슬래시 포맷일 수 있음)을
// 분석 함수들이 기대하는 정규화된 형태로 변환한다. MyPage.jsx / SpendingTrendCard.jsx / GrowthReportPage.jsx가
// 각자 이 로직을 따로 들고 있던 걸 여기 하나로 모았다.
export const normalizeTransactions = (rawList) => (rawList || []).map((item) => {
  const rawDate = item.transDate || item.TRANS_DATE || item.date || '';
  let formattedDate = rawDate;
  if (rawDate && typeof rawDate === 'string' && rawDate.includes('/')) {
    const [yy, mm, dd] = rawDate.split('/');
    formattedDate = `20${yy}-${mm}-${dd}`;
  }
  return {
    id: item.transId || item.TRAN_ID || item.trans_id || item.id || 0,
    text: item.title || item.TITLE || item.text || '',
    amount: Number(item.originalAmount || item.ORIGINAL_AMOUNT || item.amount || 0),
    date: formattedDate,
    type: item.type || item.TYPE,
    category: item.category || item.CATEGORY || '기타',
    memo: item.memo || item.MEMO || '',
    excludeAnalysis: (item.excludeAnalysis || item.EXCLUDE_ANALYSIS) === 'Y' ? 'Y' : 'N',
    currency: item.currency || item.CURRENCY || 'KRW',
    fxAmount: item.fxAmount ?? item.FX_AMOUNT ?? null,
  };
});

const isCountableExpense = (t, todayStr) =>
  t.type?.toUpperCase() === 'OUT' && t.excludeAnalysis !== 'Y' && (!t.date || t.date <= todayStr);

// 요일별(일~토) 소비 패턴 — 최근 monthsBack개월(기본 3개월)간 지출을 요일에 누적해 평균을 낸다.
// 한 달치만 보면 요일당 4~5건뿐이라 노이즈가 커서 기본을 3개월로 잡았다.
export const getWeekdayTotals = (transactions, currentDate, monthsBack = 3) => {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const cutoff = new Date(currentDate.getFullYear(), currentDate.getMonth() - (monthsBack - 1), 1);

  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);

  transactions
    .filter((t) => isCountableExpense(t, todayStr) && t.date && new Date(t.date) >= cutoff)
    .forEach((t) => {
      const day = new Date(t.date).getDay(); // 0=일 ... 6=토
      sums[day] += Math.abs(t.amount || 0);
      counts[day] += 1;
    });

  // 같은 요일이 항상 monthsBack개월 안에 4~5번씩 나오므로, "평균 1회 지출액"이 아니라
  // "요일별 총합"을 보여준다 — 어느 요일에 돈이 몰리는지가 궁금한 거지 1회 평균이 궁금한 게 아니라서.
  return ['일', '월', '화', '수', '목', '금', '토'].map((label, idx) => ({
    label,
    total: sums[idx],
    count: counts[idx],
  }));
};

// 특정 월(기본: currentDate가 속한 달) 가맹점(title) 상위 지출 랭킹.
export const getTopMerchants = (transactions, currentDate, limit = 5) => {
  const targetYM = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = new Date().toLocaleDateString('en-CA');

  const totals = {};
  transactions
    .filter((t) => isCountableExpense(t, todayStr) && t.date?.startsWith(targetYM))
    .forEach((t) => {
      const name = (t.text || '').trim() || '(내용 없음)';
      if (!totals[name]) totals[name] = { name, total: 0, count: 0, category: t.category };
      totals[name].total += Math.abs(t.amount || 0);
      totals[name].count += 1;
    });

  return Object.values(totals)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
};

// 이번 달 vs 전월 카테고리별 증감. previous가 0인데 current만 있으면(신규 카테고리) deltaPct는 null로 —
// 0에서 올라간 건 "% 증가"로 표현할 수 없어서(분모가 0) 별도 처리한다.
export const getCategoryDeltas = (transactions, currentDate) => {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const curYM = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const curTotals = {};
  const prevTotals = {};
  transactions
    .filter((t) => isCountableExpense(t, todayStr))
    .forEach((t) => {
      const cat = t.category || '기타';
      if (t.date?.startsWith(curYM)) curTotals[cat] = (curTotals[cat] || 0) + Math.abs(t.amount || 0);
      else if (t.date?.startsWith(prevYM)) prevTotals[cat] = (prevTotals[cat] || 0) + Math.abs(t.amount || 0);
    });

  const categories = new Set([...Object.keys(curTotals), ...Object.keys(prevTotals)]);
  return [...categories]
    .map((category) => {
      const current = curTotals[category] || 0;
      const previous = prevTotals[category] || 0;
      const delta = current - previous;
      const deltaPct = previous > 0 ? Math.round((delta / previous) * 100) : null;
      return { category, current, previous, delta, deltaPct };
    })
    .filter((d) => d.current > 0 || d.previous > 0);
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