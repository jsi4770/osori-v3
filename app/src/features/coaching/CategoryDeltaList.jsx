import React, { useMemo } from 'react';
import { getCategoryDeltas } from '../Util/analytics';

const formatDelta = (d) => {
  const sign = d.delta > 0 ? '+' : '';
  const pct = d.deltaPct === null ? '' : ` (${sign}${d.deltaPct}%)`;
  return `${sign}${d.delta.toLocaleString()}원${pct}`;
};

function CategoryDeltaList({ transactions = [], currentDate }) {
  const deltas = useMemo(() => getCategoryDeltas(transactions, currentDate), [transactions, currentDate]);

  const risers = [...deltas].filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const fallers = [...deltas].filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);

  if (risers.length === 0 && fallers.length === 0) {
    return (
      <section className="report-section">
        <h3>카테고리별 전월 대비 증감</h3>
        <p className="report-section-empty">전월 데이터가 쌓이면 비교해드릴게요.</p>
      </section>
    );
  }

  return (
    <section className="report-section">
      <h3>카테고리별 전월 대비 증감</h3>
      <div className="delta-columns">
        <div>
          <div className="delta-col-title">▲ 많이 늘어난 카테고리</div>
          {risers.length > 0 ? risers.map((d) => (
            <div className="delta-row" key={d.category}>
              <span className="delta-category">{d.category}</span>
              <span className="delta-value is-up">{formatDelta(d)}</span>
            </div>
          )) : <p className="report-section-empty" style={{ padding: '8px 0' }}>없음</p>}
        </div>
        <div>
          <div className="delta-col-title">▼ 많이 줄어든 카테고리</div>
          {fallers.length > 0 ? fallers.map((d) => (
            <div className="delta-row" key={d.category}>
              <span className="delta-category">{d.category}</span>
              <span className="delta-value is-down">{formatDelta(d)}</span>
            </div>
          )) : <p className="report-section-empty" style={{ padding: '8px 0' }}>없음</p>}
        </div>
      </div>
    </section>
  );
}

export default CategoryDeltaList;
