import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./MyPage.css";
import { useAuth } from "../../../context/AuthContext";
import { useAppReady } from "../../../context/AppReadyContext";
import HomeInsightCard from "../../coaching/HomeInsightCard";
import BudgetProgressCard from "./BudgetProgressCard";
import ChallengeCard from "../../coaching/ChallengeCard";
import transApi from "../../../api/transApi";
import { normalizeTransactions } from "../../Util/analytics";
import { maybeNotifyBudgetExceeded } from "../../Util/budgetLocalAlert";
import { currencyMeta, isForeign } from "../../../constants/currencies";

const MyPage = () => {
  const { user } = useAuth();
  const { markReady } = useAppReady();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [showRecent, setShowRecent] = useState(true);

  //내 가계부 지출액 표시 함수
  const loadData = async () => {
    setIsLoading(true);
    try {
      if (user?.userId) {
        const transData = await transApi.getUserTrans(user.userId);
        const mappedData = normalizeTransactions(transData);
        // 할부로 미리 생성된 미래 회차는 아직 실제로 지출된 게 아니므로, 홈 화면의 모든 지출 통계
        // (이번 달 지출, 이상치 탐지, 챌린지 진행률)에서 제외한다. 미래 회차 미리보기는
        // CalendarView에서만 별도로(회색 "예정" 표시) 다룬다.
        const todayStr = new Date().toLocaleDateString("en-CA");
        const actualData = mappedData.filter((t) => !t.date || t.date <= todayStr);
        setTransactions(actualData);
      }
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
    } finally {
      setIsLoading(false);
      markReady(); // 홈 화면(첫 진입 지점)의 초기 데이터가 준비됐으니 스플래시에 알린다
    }
  };

  const totalMonthlyExpenditure = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    return transactions
      .filter((t) => {
        // 날짜 파싱 (26/01/28 또는 2026-01-28 대응)
        const dateStr = t.date;
        if (!dateStr) return false;

        const parts = dateStr.split(/[/.-]/);
        let year, month;

        if (parts.length === 3) {
          year = parseInt(parts[0]);
          if (year < 100) year += 2000; // 26 -> 2026 변환
          month = parseInt(parts[1]) - 1;
        } else {
          const d = new Date(dateStr);
          year = d.getFullYear();
          month = d.getMonth();
        }

        // 이번 달 지출(OUT)만 필터링 — "분석에서 제외" 토글이 켜진 내역은 이 합계에도 포함하지 않는다
        return (
          year === currentYear &&
          month === currentMonth &&
          t.type?.toUpperCase() === 'OUT' &&
          t.excludeAnalysis !== 'Y'
        );
      })
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  }, [transactions, currentDate]);

  const recentExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type?.toUpperCase() === 'OUT')
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
  }, [transactions]);

  useEffect(() => {
    loadData();
  }, [user?.userId]);

  // 이번 달 지출이 월 예산을 넘으면 (앱 사용 중) 로컬 알림 — 이번 달 1회
  useEffect(() => {
    if (isLoading) return;
    const budget = Number(user?.bAmount ?? user?.bamount) || 0;
    if (budget <= 0) return;
    maybeNotifyBudgetExceeded({ monthSpent: totalMonthlyExpenditure, budget });
  }, [isLoading, totalMonthlyExpenditure, user?.bAmount, user?.bamount]);

  return (
    <main className="fade-in">
      <div className="home-summary-card">
        <div className="expense-summary-bar">
          <span className="expense-summary-label">이번 달 지출</span>
          <span className="expense-summary-amount">{totalMonthlyExpenditure.toLocaleString()}원</span>
        </div>

        <BudgetProgressCard user={user} monthlySpent={totalMonthlyExpenditure} />

        <HomeInsightCard transactions={transactions} currentDate={currentDate} isLoading={isLoading} />

        {!isLoading && <ChallengeCard transactions={transactions} />}

        <div className="home-shortcut-row">
          <button className="home-shortcut-btn" onClick={() => navigate("/mypage/expenseForm")}>
            지출 등록
          </button>
          <button className="home-shortcut-btn" onClick={() => navigate("/mypage/calendarView")}>
            내역 보기
          </button>
        </div>

        <div className="recent-expense-section">
          <div className="recent-expense-header">
            <h3>최근 지출</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={showRecent}
                onChange={() => setShowRecent((prev) => !prev)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {showRecent && (
            <ul className="recent-expense-list">
              {recentExpenses.length > 0 ? (
                recentExpenses.map((t) => (
                  <li key={t.id} className="recent-expense-item">
                    <div className="recent-expense-info">
                      <span className="recent-expense-name">{t.text}</span>
                      <span className="recent-expense-date">{t.date}</span>
                    </div>
                    <span className="recent-expense-amount">
                      {Math.abs(t.amount).toLocaleString()}원
                      {isForeign(t.currency) && t.fxAmount != null && (
                        <span style={{ marginLeft: 6, fontSize: "0.72rem", fontWeight: 700, color: "var(--text-weak)" }}>
                          {currencyMeta(t.currency).flag} {currencyMeta(t.currency).symbol}{Number(t.fxAmount).toLocaleString()}
                        </span>
                      )}
                    </span>
                  </li>
                ))
              ) : (
                <li className="recent-expense-empty">최근 지출 내역이 없습니다.</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
};

export default MyPage;
