import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { zScore } from '../Util/zScore';
import { requestCompositeNudge } from '../../api/coachingApi';
import { useFeedback } from '../../context/FeedbackContext';
import './HomeInsightCard.css';

// 이상치가 없을 때 보여주는 클라이언트 전용 격려 메시지 (API 호출 없음).
const EMPTY_MESSAGES = [
  "이번 달은 아주 계획적으로 소비하고 계시네요!",
  "지갑이 오소리 덕분에 튼튼해요!",
];

// "본문 (평소 대비 N원 ↑)" 형태의 메시지에서 괄호 안 보조 설명을 분리해
// 본문은 그대로, 보조 설명은 줄바꿈 + 작은 글씨로 보여주기 위한 헬퍼.
const splitMessage = (text) => {
  const match = text.match(/^(.*?)\s*(\([^)]*\))\s*$/);
  return match ? { main: match[1], detail: match[2] } : { main: text, detail: null };
};

// 홈 화면 인사이트 카드: 위트 메시지(Tier 0, 항상/무료) → "AI 진단" 펼치면 룰 기반 상세(Tier 1, 무료)
// → "AI와 대화하며 계획 세우기"를 눌러야만 실제 Gemini 호출(Tier 2)이 일어난다.
const HomeInsightCard = ({ transactions = [], currentDate, isLoading = false }) => {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const userId = user?.userId;

  const [expanded, setExpanded] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);

  const anomalies = useMemo(
    () => (currentDate ? zScore(transactions, currentDate) : []),
    [transactions, currentDate]
  );

  const monthlyRanking = useMemo(() => {
    if (!currentDate) return [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totals = {};
    transactions.forEach((t) => {
      if (t.type?.toUpperCase() !== 'OUT') return;
      if (t.excludeAnalysis === 'Y') return;
      const d = new Date(t.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const cat = t.category || '기타';
      totals[cat] = (totals[cat] || 0) + Math.abs(t.amount || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [transactions, currentDate]);

  const hasAnomaly = anomalies.length > 0;

  const handleDeepDiagnose = async () => {
    if (!userId || diagnosing) return;
    setDiagnosing(true);
    try {
      const nudge = await requestCompositeNudge({
        userId,
        anomalies: anomalies.map((a) => ({
          category: a.category,
          originalAmount: a.originalAmount,
          avgAmount: a.avgAmount,
        })),
      });
      navigate(`/mypage/coaching/chat/${nudge.threadId}`);
    } catch (error) {
      toast(error?.response?.data?.message || 'AI 진단을 잠시 사용할 수 없어요.', { type: "error" });
    } finally {
      setDiagnosing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="notification-list-container">
        <div className="notification-list">
          <div className="notification-item notification-loading">로딩중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-list-container">
      <div className="notification-list">
        {hasAnomaly
          ? anomalies.map((a) => {
              const { main, detail } = splitMessage(a.message);
              return (
                <div key={a.id} className="notification-item">
                  <span className="notification-main">{main}</span>
                  {detail && <span className="notification-detail">{detail}</span>}
                </div>
              );
            })
          : EMPTY_MESSAGES.map((text, i) => (
              <div key={i} className="notification-item">
                <span className="notification-main">{text}</span>
              </div>
            ))}
      </div>

      <button
        className="insight-toggle-btn"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? 'AI 진단 접기 ▲' : 'AI 진단 보기 ▼'}
      </button>

      {expanded && (
        <div className="insight-detail">
          {hasAnomaly ? (
            <>
              <ul className="insight-breakdown">
                {anomalies.map((a) => {
                  const pct = a.avgAmount > 0
                    ? Math.round(((a.originalAmount - a.avgAmount) / a.avgAmount) * 100)
                    : 0;
                  return (
                    <li key={a.id}>
                      <span className="insight-breakdown-cat">{a.category}</span>
                      <span className="insight-breakdown-amt">
                        이번 {a.originalAmount.toLocaleString()}원 · 평소 {a.avgAmount.toLocaleString()}원 ({pct}%↑)
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="insight-summary">
                {anomalies.length === 1
                  ? `이번 달은 ${anomalies[0].category}에서 지출이 유독 두드러졌어요.`
                  : `이번 달은 ${anomalies.map((a) => a.category).join(', ')}에서 지출이 두드러졌어요.`}
              </p>
              <button className="insight-cta-btn" onClick={handleDeepDiagnose} disabled={diagnosing}>
                {diagnosing ? '진단 준비 중...' : 'AI와 대화하며 계획 세우기'}
              </button>
            </>
          ) : (
            <>
              {monthlyRanking.length > 0 ? (
                <>
                  <ul className="insight-breakdown">
                    {monthlyRanking.slice(0, 3).map(([cat, amount]) => (
                      <li key={cat}>
                        <span className="insight-breakdown-cat">{cat}</span>
                        <span className="insight-breakdown-amt">{amount.toLocaleString()}원</span>
                      </li>
                    ))}
                  </ul>
                  <p className="insight-summary">
                    이번 달은 아직 이상 신호가 없어요. {monthlyRanking[0][0]}이(가) 가장 큰 지출이에요.
                  </p>
                </>
              ) : (
                <p className="insight-summary">이번 달 지출 데이터가 아직 없어요.</p>
              )}
              <button className="insight-cta-btn" onClick={() => navigate('/mypage/coaching/report')}>
                AI와 소비 흐름 보러가기
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HomeInsightCard;
