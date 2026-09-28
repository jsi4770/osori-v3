import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fixedTransApi } from '../../../api/fixedTransApi';
import { IconReceipt } from '../../../components/icons';
import './UpcomingFixedExpensesCard.css';

const daysInMonth = (year, monthIndex0) => new Date(year, monthIndex0 + 1, 0).getDate();

// payDay(1~30, 31=매달 말일)로부터 "오늘 이후 가장 가까운 결제일"을 계산한다.
// FixedTransPage 등록 시 쓰는 말일 클램핑(2월엔 28/29일 등)과 동일한 규칙을 적용한다.
const nextOccurrence = (payDay, today) => {
  const targetDay = (y, m) => Math.min(payDay === 31 ? 31 : payDay, daysInMonth(y, m));
  let y = today.getFullYear();
  let m = today.getMonth();
  let candidate = new Date(y, m, targetDay(y, m));
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (candidate < todayMid) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    candidate = new Date(y, m, targetDay(y, m));
  }
  return candidate;
};

const ddayLabel = (dday) => {
  if (dday === 0) return '오늘';
  if (dday === 1) return '내일';
  return `${dday}일 후`;
};

// 홈 화면 하단 — "곧 나갈 고정지출" 미리보기. 고정지출 탭에 이미 있는 목록/D-day 계산을 그대로 홈에서도
// 재사용해, 전체 관리 화면을 열지 않아도 다가오는 결제를 바로 알 수 있게 한다.
function UpcomingFixedExpensesCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.userId) return;
    let cancelled = false;
    fixedTransApi.list(user.userId)
      .then((data) => { if (!cancelled) setList(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setList([]); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [user?.userId]);

  const upcoming = useMemo(() => {
    const today = new Date();
    return list
      .map((item) => {
        const date = nextOccurrence(Number(item.payDay), today);
        const dday = Math.round((date - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
        return { ...item, nextDate: date, dday };
      })
      .sort((a, b) => a.dday - b.dday)
      .slice(0, 3);
  }, [list]);

  if (!loaded || upcoming.length === 0) return null;

  return (
    <div className="upcoming-fixed-card">
      <div className="upcoming-fixed-header" onClick={() => navigate('/mypage/fixedTrans')}>
        <h3>곧 나갈 고정지출</h3>
        <span className="upcoming-fixed-more">전체보기 ›</span>
      </div>
      <div className="upcoming-fixed-list">
        {upcoming.map((item) => (
          <div className="upcoming-fixed-row" key={item.fixedId}>
            <IconReceipt size={15} className="upcoming-fixed-icon" aria-hidden="true" />
            <span className="upcoming-fixed-name">{item.name}</span>
            <span className={`upcoming-fixed-dday ${item.dday <= 1 ? 'is-soon' : ''}`}>{ddayLabel(item.dday)}</span>
            <span className="upcoming-fixed-amount">{Number(item.amount).toLocaleString()}원</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UpcomingFixedExpensesCard;
