import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getGrowthReport } from '../../api/coachingApi';
import transApi from '../../api/transApi';
import { normalizeTransactions } from '../Util/analytics';
import { IconCheck, IconSkip, IconClock } from '../../components/icons';
import SpendingTrendCard from './SpendingTrendCard';
import ReportStatCards from './ReportStatCards';
import WeekdaySpendingChart from './WeekdaySpendingChart';
import TopMerchantsList from './TopMerchantsList';
import CategoryDeltaList from './CategoryDeltaList';
import ExpenseChart from '../auth/pages/ExpenseChart';
import MonthlyTrendChart from '../auth/pages/MonthlyTrendChart';
import './GrowthReportPage.css';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

const acceptedBadge = (accepted) => {
  if (accepted === 'Y') return { icon: IconCheck, text: '실행함', className: 'accepted' };
  if (accepted === 'N') return { icon: IconSkip, text: '건너뜀', className: 'dismissed' };
  return { icon: IconClock, text: '미응답', className: 'pending' };
};

const GrowthReportPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.userId;

  const [nudges, setNudges] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  const [transactions, setTransactions] = useState([]);
  const [analysisDate, setAnalysisDate] = useState(new Date());
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef(null);

  const analysisYear = analysisDate.getFullYear();
  const analysisMonth = analysisDate.getMonth() + 1;

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    setActiveSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  const goToSlide = (index) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  };

  const handlePrevMonth = () => {
    setAnalysisDate(new Date(analysisDate.getFullYear(), analysisDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setAnalysisDate(new Date(analysisDate.getFullYear(), analysisDate.getMonth() + 1, 1));
  };

  useEffect(() => {
    if (!userId) {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const report = await getGrowthReport(userId);
        if (cancelled) return;
        setNudges(Array.isArray(report) ? report : []);
        setStatus('ready');
      } catch (error) {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await transApi.getUserTrans(userId);
        if (cancelled) return;
        const todayStr = new Date().toLocaleDateString('en-CA');
        // 할부 미래 회차는 아직 실제 지출이 아니므로 모든 리포트 집계에서 제외
        setTransactions(normalizeTransactions(raw).filter((t) => !t.date || t.date <= todayStr));
      } catch {
        if (!cancelled) setTransactions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <main className="growth-report-page fade-in">
      <ReportStatCards transactions={transactions} currentDate={analysisDate} />

      <div className="home-analysis-section">
        <div className="month-selector-container">
          <div className="month-nav-group">
            <button onClick={handlePrevMonth} className="nav-btn">◀</button>
            <span className="month-nav-label">{analysisYear}년 {analysisMonth}월 분석</span>
            <button onClick={handleNextMonth} className="nav-btn">▶</button>
          </div>
        </div>

        <div className="chart-carousel" ref={carouselRef} onScroll={handleCarouselScroll}>
          <div className="chart-slide">
            <ExpenseChart transactions={transactions} currentDate={analysisDate} />
          </div>
          <div className="chart-slide">
            <MonthlyTrendChart transactions={transactions} currentDate={analysisDate} />
          </div>
        </div>

        <div className="carousel-dots">
          {[0, 1].map((i) => (
            <button
              key={i}
              className={`carousel-dot ${activeSlide === i ? 'active' : ''}`}
              onClick={() => goToSlide(i)}
              aria-label={`${i + 1}번째 분석 보기`}
            />
          ))}
        </div>
      </div>

      <WeekdaySpendingChart transactions={transactions} currentDate={analysisDate} />
      <TopMerchantsList transactions={transactions} currentDate={analysisDate} />
      <CategoryDeltaList transactions={transactions} currentDate={analysisDate} />

      <SpendingTrendCard />

      {status === 'loading' && <p className="grp-empty">불러오는 중...</p>}
      {status === 'error' && <p className="grp-empty">코칭 기능을 잠시 사용할 수 없어요.</p>}

      {status === 'ready' && nudges.length === 0 && (
        <p className="grp-empty">아직 코칭 이력이 없어요.</p>
      )}

      {status === 'ready' && nudges.length > 0 && (
        <section className="grp-timeline">
          {nudges.map((n) => {
            const badge = acceptedBadge(n.accepted);
            const BadgeIcon = badge.icon;
            return (
              <div key={n.messageId} className="grp-item">
                <div className="grp-item-top">
                  <span className="grp-category">{n.category || '기타'}</span>
                  <span className={`grp-badge ${badge.className}`}><BadgeIcon size={13} /> {badge.text}</span>
                </div>

                <p className="grp-content">{n.content}</p>

                {n.originalAmount != null && n.avgAmount != null && (
                  <p className="grp-amounts">
                    이번 {Number(n.originalAmount).toLocaleString()}원
                    {' · '}평소 {Number(n.avgAmount).toLocaleString()}원
                  </p>
                )}

                <div className="grp-item-bottom">
                  <span className="grp-date">{formatDate(n.createdAt)}</span>
                  <div className="grp-actions">
                    <button
                      className="grp-chat-btn"
                      onClick={() => navigate(`/mypage/coaching/chat/${n.threadId}`)}
                    >
                      대화하기
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
};

export default GrowthReportPage;
