import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getGrowthReport, sendChatMessage } from '../../api/coachingApi';
import { extractChallenge, createChallenge } from '../../api/challengeApi';
import { IconArrowUp } from '../../components/icons';
import { useFeedback } from '../../context/FeedbackContext';
import './CoachChatPage.css';

const CoachChatPage = () => {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useFeedback();
  const userId = user?.userId;

  const [messages, setMessages] = useState([]); // {id, role, content}
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const [extracting, setExtracting] = useState(false);
  const [proposedChallenge, setProposedChallenge] = useState(null);
  const [savingChallenge, setSavingChallenge] = useState(false);

  // 진입 시 이 thread의 최초 넛지를 코치의 첫 말풍선으로 보여준다.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const report = await getGrowthReport(userId);
        if (cancelled || !Array.isArray(report)) return;
        const nudge = report.find(n => String(n.threadId) === String(threadId));
        if (nudge) {
          setMessages([{ id: nudge.messageId, role: nudge.role || 'NUDGE', content: nudge.content }]);
        }
      } catch (error) {
        // 초기 넛지 로드 실패는 조용히 무시 — 사용자는 그대로 대화를 시작할 수 있다.
      }
    })();
    return () => { cancelled = true; };
  }, [userId, threadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { id: `user-${Date.now()}`, role: 'USER', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const reply = await sendChatMessage({ threadId, userId, message: text });
      setMessages(prev => [...prev, {
        id: reply.messageId || `coach-${Date.now()}`,
        role: reply.role || 'COACH',
        content: reply.content,
      }]);
    } catch (error) {
      const message = error?.response?.data?.message || '코칭 기능을 잠시 사용할 수 없어요.';
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'COACH',
        content: message,
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExtractChallenge = async () => {
    if (!userId || extracting) return;
    setExtracting(true);
    try {
      const result = await extractChallenge({ threadId, userId });
      if (!result.found) {
        const message = result.reason === 'LLM_DISABLED'
          ? '지금은 AI 코칭이 꺼져 있어 챌린지 추출을 사용할 수 없어요.'
          : '대화에서 아직 구체적인 목표를 찾지 못했어요. 조금 더 얘기해볼까요?';
        toast(message, { type: "info" });
        return;
      }
      setProposedChallenge(result);
    } catch (error) {
      toast(error?.response?.data?.message || '챌린지 추출에 실패했어요.', { type: "error" });
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirmChallenge = async () => {
    if (!proposedChallenge || savingChallenge) return;
    setSavingChallenge(true);
    try {
      await createChallenge({
        userId,
        threadId,
        category: proposedChallenge.category || null,
        title: proposedChallenge.title,
        metricType: proposedChallenge.metricType,
        targetValue: proposedChallenge.targetValue,
        periodDays: proposedChallenge.periodDays,
      });
      setProposedChallenge(null);
      toast('챌린지가 생성됐어요! 홈 화면에서 진행률을 확인할 수 있어요.', { type: "success" });
      navigate('/mypage/assets');
    } catch (error) {
      toast(error?.response?.data?.message || '챌린지 저장에 실패했어요.', { type: "error" });
    } finally {
      setSavingChallenge(false);
    }
  };

  return (
    <main className="coach-chat-page fade-in">
      <header className="ccp-header">
        <button className="ccp-back" onClick={() => navigate(-1)}>←</button>
        <h2>AI 재무 코치</h2>
        <button className="ccp-challenge-btn" onClick={handleExtractChallenge} disabled={extracting}>
          {extracting ? '분석 중...' : '챌린지'}
        </button>
      </header>

      <div className="ccp-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="ccp-empty">코치와 대화를 시작해보세요.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`ccp-bubble-row ${m.role === 'USER' ? 'user' : 'coach'}`}>
            <div className={`ccp-bubble ${m.role === 'USER' ? 'user' : 'coach'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="ccp-bubble-row coach">
            <div className="ccp-bubble coach ccp-typing">코치가 입력 중...</div>
          </div>
        )}
      </div>

      <div className="ccp-input-area">
        <input
          type="text"
          className="ccp-input"
          placeholder="메시지를 입력하세요"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className="ccp-send"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          aria-label="전송"
        >
          <IconArrowUp size={20} />
        </button>
      </div>

      {proposedChallenge && (
        <div className="ccp-challenge-overlay" onClick={() => setProposedChallenge(null)}>
          <div className="ccp-challenge-modal" onClick={(e) => e.stopPropagation()}>
            <h3>이 챌린지로 시작할까요?</h3>
            <p className="ccp-challenge-title">{proposedChallenge.title}</p>
            <p className="ccp-challenge-detail">
              {proposedChallenge.category && `${proposedChallenge.category} · `}
              {proposedChallenge.metricType === 'COUNT'
                ? `최대 ${proposedChallenge.targetValue}회`
                : `최대 ${Number(proposedChallenge.targetValue).toLocaleString()}원`}
              {' · '}{proposedChallenge.periodDays}일간
            </p>
            <div className="ccp-challenge-actions">
              <button className="ccp-challenge-cancel" onClick={() => setProposedChallenge(null)}>
                취소
              </button>
              <button className="ccp-challenge-confirm" onClick={handleConfirmChallenge} disabled={savingChallenge}>
                {savingChallenge ? '저장 중...' : '확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default CoachChatPage;
