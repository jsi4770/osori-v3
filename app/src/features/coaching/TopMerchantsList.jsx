import React, { useMemo } from 'react';
import { getTopMerchants } from '../Util/analytics';

function TopMerchantsList({ transactions = [], currentDate }) {
  const merchants = useMemo(() => getTopMerchants(transactions, currentDate, 5), [transactions, currentDate]);
  const maxTotal = merchants.length > 0 ? merchants[0].total : 0;

  return (
    <section className="report-section">
      <h3>가맹점 TOP 5</h3>
      {merchants.length > 0 ? (
        <div className="merchant-list">
          {merchants.map((m, idx) => (
            <div className="merchant-row" key={m.name}>
              <span className="merchant-rank">{idx + 1}</span>
              <div className="merchant-info">
                <div className="merchant-name-row">
                  <span className="merchant-name">{m.name}</span>
                  <span className="merchant-count">{m.count}건</span>
                </div>
                <div className="merchant-bar-track">
                  <div
                    className="merchant-bar-fill"
                    style={{ width: `${maxTotal > 0 ? (m.total / maxTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="merchant-amount">{m.total.toLocaleString()}원</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="report-section-empty">이번 달 지출 내역이 없어요.</p>
      )}
    </section>
  );
}

export default TopMerchantsList;
