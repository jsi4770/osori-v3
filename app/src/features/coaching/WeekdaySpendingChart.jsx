import React, { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getWeekdayTotals } from '../Util/analytics';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const MONTHS_BACK = 3;

// 요일별 소비 패턴 — 단일 시리즈(총합)라 카테고리 팔레트를 쓰지 않고, 가장 많이 쓰는 요일만
// 브랜드 색으로 강조하고 나머지는 중립 회색으로 둔다(MonthlyTrendChart의 강조 방식과 동일한 규칙).
function WeekdaySpendingChart({ transactions = [], currentDate }) {
  const weekdayTotals = useMemo(
    () => getWeekdayTotals(transactions, currentDate, MONTHS_BACK),
    [transactions, currentDate]
  );

  const hasData = weekdayTotals.some((d) => d.total > 0);
  const maxTotal = Math.max(...weekdayTotals.map((d) => d.total));

  const data = {
    labels: weekdayTotals.map((d) => d.label),
    datasets: [
      {
        data: weekdayTotals.map((d) => d.total),
        backgroundColor: weekdayTotals.map((d) => (d.total === maxTotal && maxTotal > 0 ? '#0066ff' : '#dcdde1')),
        borderRadius: 4,
        barThickness: 22,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const d = weekdayTotals[ctx.dataIndex];
            return ` ${d.total.toLocaleString()}원 · 총 ${d.count}건`;
          },
        },
      },
    },
    scales: {
      y: { beginAtZero: true, ticks: { display: false }, grid: { display: false } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  return (
    <section className="report-section">
      <h3>요일별 소비 패턴 <span style={{ fontWeight: 500, color: 'var(--text-weak)', fontSize: '0.75rem' }}>(최근 {MONTHS_BACK}개월)</span></h3>
      {hasData ? (
        <div className="weekday-chart-wrap">
          <Bar data={data} options={options} />
        </div>
      ) : (
        <p className="report-section-empty">아직 분석할 지출 내역이 없어요.</p>
      )}
    </section>
  );
}

export default WeekdaySpendingChart;
