import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import styles from './MyAccountBook.module.css';
import { EXPENSE_CATEGORIES, isFixedCategory } from '../../../constants/categories';

ChartJS.register(ArcElement, Tooltip, Legend);

// 변동비 카테고리는 눈에 띄는 컬러로, 고정비 카테고리(주거/월세·통신비·보험·구독서비스)는
// 무채색 계열로 구분해 "매달 똑같이 나가는 돈"과 "조절 가능한 소비"를 색으로 한눈에 구분한다.
const VARIABLE_COLORS = ['#FF6384', '#4BC0C0', '#FFCE56', '#36A2EB', '#9966FF', '#FF9F40', '#65be71', '#C9CBCF'];
const FIXED_COLORS = ['#64748b', '#94a3b8', '#475569', '#334155'];

const CATEGORY_COLORS = (() => {
  const map = {};
  let vIdx = 0, fIdx = 0;
  EXPENSE_CATEGORIES.forEach((cat) => {
    if (isFixedCategory(cat)) {
      map[cat] = FIXED_COLORS[fIdx % FIXED_COLORS.length];
      fIdx += 1;
    } else {
      map[cat] = VARIABLE_COLORS[vIdx % VARIABLE_COLORS.length];
      vIdx += 1;
    }
  });
  return map;
})();

// 사용자가 설정 탭에서 추가한 커스텀 카테고리는 이 정적 맵에 없으므로, 이름 기반 해시로 색을
// 안정적으로(렌더할 때마다 같은 색으로) 배정한다.
const colorFor = (cat) => {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  let hash = 0;
  for (let i = 0; i < cat.length; i += 1) hash = (hash * 31 + cat.charCodeAt(i)) >>> 0;
  return VARIABLE_COLORS[hash % VARIABLE_COLORS.length];
};

function ExpenseChart({ transactions = [], currentDate }) {
  if (!currentDate || !(currentDate instanceof Date)) return null;
  const targetYear = currentDate.getFullYear();
  const targetMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const targetYM = `${targetYear}-${targetMonth}`;

  const expenses = transactions.filter(t =>
    t.type?.toUpperCase() === 'OUT' &&
    t.date.startsWith(targetYM) &&
    t.excludeAnalysis !== 'Y'
  );

  const analysisData = expenses.reduce((acc, curr) => {
    // 커스텀 카테고리도(기본 목록에 없더라도) 그대로 자기 이름으로 집계한다 — 여기서 '기타'로
    // 뭉개버리면 사용자가 새로 만든 카테고리가 항상 '기타'에 섞여 보이는 문제가 생긴다.
    const category = curr.category || '기타';

    acc[category] = (acc[category] || 0) + Math.abs(curr.amount);
    return acc;
  }, {});

  const labels = Object.keys(analysisData).filter(cat => analysisData[cat] > 0);
  const dataValues = labels.map(cat => analysisData[cat]);

  const totalExpenditure = dataValues.reduce((sum, val) => sum + val, 0);
  const fixedTotal = labels.reduce((sum, cat) => sum + (isFixedCategory(cat) ? analysisData[cat] : 0), 0);
  const variableTotal = totalExpenditure - fixedTotal;

  const data = {
    labels: labels,
    datasets: [
      {
        data: dataValues,
        backgroundColor: labels.map(cat => colorFor(cat)),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        align: 'center',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: { size: 12, weight: 'bold' }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${context.raw.toLocaleString()}원`
        }
      }
    },
    layout: { padding: { left: 10, right: 10 } }
  };

  if (expenses.length === 0) {
    return (
      <div className={styles['chart-card']}>
        <h3>카테고리 별 소비 분석</h3>
        <p style={{ padding: '50px 0', color: '#888', textAlign: 'center' }}>분석할 지출 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles['chart-card']}>
      <h3>카테고리 별 소비 분석</h3>
      <div className={styles['chart-main-container']}>
        <Doughnut data={data} options={options}/>
      </div>
      <div className={styles['chart-summary']}>
          총 지출: <strong> {totalExpenditure.toLocaleString()}원 </strong>
          {fixedTotal > 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-weak)', fontWeight: 600, marginTop: 4 }}>
              고정비 {fixedTotal.toLocaleString()}원 · 변동비 {variableTotal.toLocaleString()}원
            </div>
          )}
      </div>
      {fixedTotal > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-weak)', textAlign: 'center', marginTop: 2 }}>
          회색 계열: 고정비 카테고리(주거/월세·통신비·보험·구독서비스)
        </div>
      )}
    </div>
  );
}

export default ExpenseChart;