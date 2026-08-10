import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getChallenges, deleteChallenge } from '../../api/challengeApi';
import { useFeedback } from '../../context/FeedbackContext';
import './ChallengeCard.css';

const formatValue = (metricType, value) =>
  metricType === 'COUNT' ? `${value}회` : `${value.toLocaleString()}원`;

// 챌린지 진행률은 저장하지 않고, 실제 거래 데이터로 매번 계산한다 — 배치/크론이 필요 없다.
const computeProgress = (challenge, transactions) => {
  const start = new Date(challenge.startDate);
  const end = new Date(challenge.endDate);
  end.setHours(23, 59, 59, 999);

  const relevant = transactions.filter((t) => {
    if (t.type?.toUpperCase() !== 'OUT') return false;
    if (t.excludeAnalysis === 'Y') return false;
    if (challenge.category && (t.category || '기타') !== challenge.category) return false;
    const d = new Date(t.date);
    return d >= start && d <= end;
  });

  const current = challenge.metricType === 'COUNT'
    ? relevant.length
    : relevant.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  const now = new Date();
  const isEnded = now > end;
  const success = current <= challenge.targetValue;
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
  const pct = challenge.targetValue > 0 ? Math.min(100, Math.round((current / challenge.targetValue) * 100)) : 0;

  return { current, isEnded, success, daysLeft, pct };
};

const ChallengeCard = ({ transactions = [] }) => {
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();
  const userId = user?.userId;

  const [challenges, setChallenges] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    if (!userId) {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await getChallenges(userId);
        if (!cancelled) {
          setChallenges(Array.isArray(list) ? list : []);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleDelete = async (challengeId) => {
    const ok = await confirm('이 챌린지를 그만둘까요?');
    if (!ok) return;
    try {
      await deleteChallenge(challengeId, userId);
      setChallenges((prev) => prev.filter((c) => c.challengeId !== challengeId));
    } catch {
      toast('챌린지 삭제에 실패했어요.', { type: "error" });
    }
  };

  if (status !== 'ready' || challenges.length === 0) {
    return null;
  }

  return (
    <div className="challenge-card-list">
      {challenges.map((challenge) => {
        const progress = computeProgress(challenge, transactions);
        return (
          <div key={challenge.challengeId} className="challenge-card">
            <div className="challenge-card-top">
              <span className="challenge-card-title">🎯 {challenge.title}</span>
              <button
                className="challenge-card-close"
                onClick={() => handleDelete(challenge.challengeId)}
                aria-label="챌린지 그만두기"
              >
                ✕
              </button>
            </div>

            {progress.isEnded ? (
              <p className={`challenge-card-result ${progress.success ? 'success' : 'fail'}`}>
                {progress.success ? '달성했어요! 🎉' : '이번엔 아쉬웠어요.'}
                {' '}({formatValue(challenge.metricType, progress.current)} / {formatValue(challenge.metricType, challenge.targetValue)})
              </p>
            ) : (
              <>
                <div className="challenge-progress-bar">
                  <div
                    className={`challenge-progress-fill ${progress.pct >= 100 ? 'over' : ''}`}
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
                <div className="challenge-card-bottom">
                  <span>{formatValue(challenge.metricType, progress.current)} / {formatValue(challenge.metricType, challenge.targetValue)}</span>
                  <span>D-{progress.daysLeft}</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChallengeCard;
