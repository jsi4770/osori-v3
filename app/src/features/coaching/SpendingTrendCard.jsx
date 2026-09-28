import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import transApi from '../../api/transApi';
import { getSpendingTrend } from '../../api/coachingApi';
import { getCategoryMonthlyTotals, normalizeTransactions } from '../Util/analytics';
import './SpendingTrendCard.css';

const SpendingTrendCard = () => {
  const { user } = useAuth();
  const userId = user?.userId;

  const [status, setStatus] = useState('loading'); // loading | ready | empty
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!userId) {
      setStatus('empty');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const transactions = await transApi.getUserTrans(userId);
        if (cancelled) return;

        const monthlyTotals = getCategoryMonthlyTotals(normalizeTransactions(transactions), new Date());
        if (monthlyTotals.length === 0) {
          setStatus('empty');
          return;
        }

        const yearMonth = monthlyTotals[monthlyTotals.length - 1].yearMonth;
        const trend = await getSpendingTrend({ userId, yearMonth, monthlyTotals });
        if (cancelled) return;
        setContent(trend.content);
        setStatus('ready');
      } catch (error) {
        if (!cancelled) setStatus('empty');
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  if (status === 'loading') {
    return (
      <section className="spending-trend-card">
        <p className="stc-empty">소비 흐름을 분석하는 중...</p>
      </section>
    );
  }
  if (status === 'empty') {
    return null;
  }

  return (
    <section className="spending-trend-card">
      <h3>이번 달 소비 흐름 분석</h3>
      <p className="stc-content">{content}</p>
    </section>
  );
};

export default SpendingTrendCard;
