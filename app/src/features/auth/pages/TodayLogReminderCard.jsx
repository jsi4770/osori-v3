import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck } from '../../../components/icons';
import './TodayLogReminderCard.css';

// 오늘 지출을 아직 기록 안 했으면 빠른입력으로 바로 이어주는 리마인더, 이미 기록했으면
// 짧은 확인 멘트로 바꿔 매일 기록하는 습관을 강화한다(리마인더가 항상 뜨면 무시하게 되므로
// 이미 기록한 날은 "잘하고 있다"는 긍정 피드백으로 톤을 바꾼다).
function TodayLogReminderCard({ transactions = [] }) {
  const navigate = useNavigate();

  const todayCount = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return transactions.filter((t) => t.type?.toUpperCase() === 'OUT' && t.date === todayStr).length;
  }, [transactions]);

  if (todayCount > 0) {
    return (
      <div className="today-log-card today-log-done">
        <IconCheck size={16} />
        <span>오늘 지출 {todayCount}건 기록 완료! 꾸준히 잘하고 있어요.</span>
      </div>
    );
  }

  return (
    <div className="today-log-card today-log-pending">
      <span>오늘 아직 지출 기록이 없어요.<br />잊기 전에 남겨볼까요?</span>
      <button className="today-log-btn" onClick={() => navigate('/mypage/expenseForm')}>
        지금 기록하기
      </button>
    </div>
  );
}

export default TodayLogReminderCard;
