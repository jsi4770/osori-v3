import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './CalendarView.css';
import transApi from '../../api/transApi';
import { fixedTransApi } from '../../api/fixedTransApi';
import { fetchHolidays } from '../../api/holidayApi';
import TransactionModal from '../auth/pages/TransactionModal';
import { FIXED_AUTO_MEMO } from '../Util/zScore';
import { useFeedback } from '../../context/FeedbackContext';

// 달력 칸은 폭이 좁아 십만 단위 이상이면 잘리므로 만/억 단위로 축약해 표기한다.
// (우측 가계부 패널은 전체 금액을 그대로 보여준다)
// "YYYY-MM-DD" -> "YYYY년 MM월 DD일"
const fmtKoreanDate = (dateStr) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) return dateStr || "";
  return `${m[1]}년 ${m[2]}월 ${m[3]}일`;
};

const fmtCompact = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e8) return (n / 1e8).toFixed(abs % 1e8 === 0 ? 0 : 1).replace(/\.0$/, "") + "억";
  if (abs >= 1e4) return (n / 1e4).toFixed(abs % 1e4 === 0 ? 0 : 1).replace(/\.0$/, "") + "만";
  return n.toLocaleString();
};

function CalendarView({ currentDate, setCurrentDate }) {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [fixedTrans, setFixedTrans] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [holidays, setHolidays] = useState({});
  const [listMode, setListMode] = useState('day'); // 'day' | 'month'
  const [searchTerm, setSearchTerm] = useState('');

  // 수정/삭제 모달
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view'); // 'view' | 'edit' | 'delete'
  const [selectedItem, setSelectedItem] = useState(null);

  const userId = user?.userId || user?.USER_ID || user?.id;

  const normalizeDate = (dateStr) => {
    if (!dateStr) return "";
    const cleanStr = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
    const parts = cleanStr.split(/[/|-]/);
    if (parts.length === 3) {
      let [y, m, d] = parts;
      if (y.length === 2) y = "20" + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return cleanStr;
  };

  // 내가 등록한 수입/지출 내역을 가계부와 동일하게 불러온다(로그인 토큰 기반 api 인스턴스 사용).
  const fetchTransactions = () => {
    if (!userId) return;
    transApi.getUserTrans(userId)
      .then(data => {
        if (!Array.isArray(data)) {
          setTransactions([]);
          return;
        }
        const mapped = data.map(t => ({
          id: t.transId || t.TRANS_ID || t.trans_id || t.id || 0,
          text: t.title || t.TITLE || '내역 없음',
          date: normalizeDate(t.transDate || t.TRANS_DATE || t.date || t.DATE),
          category: t.category || t.CATEGORY || '기타',
          type: (t.type || t.TYPE || 'OUT').toUpperCase(),
          amount: Number(t.originalAmount || t.ORIGINAL_AMOUNT || t.amount || 0),
          memo: t.memo || t.MEMO || '',
          excludeAnalysis: (t.excludeAnalysis || t.EXCLUDE_ANALYSIS) === 'Y' ? 'Y' : 'N',
        }));
        setTransactions(mapped);
      })
      .catch(err => console.error("내역 로드 실패:", err));
  };

  useEffect(() => { fetchTransactions(); }, [userId]);

  // 고정지출 목록(예정일 미리보기 계산용). 실제 등록 여부는 스케줄러가 만드는 실제 내역이 결정한다.
  useEffect(() => {
    if (!userId) return;
    fixedTransApi.list(userId)
      .then(data => setFixedTrans(Array.isArray(data) ? data : []))
      .catch(err => console.error("고정지출 로드 실패:", err));
  }, [userId]);

  //공휴일
  useEffect(() => {
    const getHolidays = async () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const data = await fetchHolidays(year, month);
      setHolidays(data);
    };
    getHolidays();
  }, [currentDate]);

  const getTileClassName = ({ date, view }) => {
    if (view === 'month') {
      const dateStr = date.toLocaleDateString('en-CA');
      if (holidays[dateStr] || date.getDay() === 0) return 'holiday-red';
      if (date.getDay() === 6) return 'holiday-blue';
    }
    return null;
  };

  // 우측 목록: '이 날' 또는 '이 달 전체' + 검색어
  const listItems = useMemo(() => {
    let base;
    if (listMode === 'day') {
      base = transactions.filter(item => item.date === selectedDate);
    } else {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      base = transactions
        .filter(item => {
          const d = new Date(item.date);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    const term = searchTerm.trim().toLowerCase();
    if (!term) return base;
    return base.filter(item =>
      item.text.toLowerCase().includes(term) || item.category.toLowerCase().includes(term)
    );
  }, [transactions, selectedDate, listMode, currentDate, searchTerm]);

  // 이번에 보고 있는 달 기준, 아직 실제 내역으로 등록되지 않은(오늘 이후) 고정지출 예정일 → 회색 미리보기용.
  // 실제 지출 집계(monthlyTotalExpense)에는 포함하지 않는다: 스케줄러가 당일 실제 내역을 만들면
  // 그때부터는 transactions에 잡혀 정상적으로 집계된다.
  const upcomingFixedByDate = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toLocaleDateString('en-CA');
    const map = {};
    fixedTrans.forEach(f => {
      const payDay = Number(f.payDay);
      if (!payDay) return;
      // PAY_DAY가 그 달 일수보다 크면(예: 31일 지정) 그 달의 마지막 날로 clamp — 백엔드 스케줄러와 동일한 규칙
      const occDay = Math.min(payDay, daysInMonth);
      const occDate = new Date(year, month, occDay).toLocaleDateString('en-CA');
      if (occDate <= todayStr) return; // 오늘 이하는 이미 실제 내역으로 등록됐을 날짜라 미리보기 불필요
      const amount = Number(f.amount || 0);
      if (!map[occDate]) map[occDate] = [];
      map[occDate].push({ name: f.name, amount, category: f.category });
    });
    return map;
  }, [fixedTrans, currentDate]);

  const monthlyTotalExpense = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return transactions
      .filter(item => {
        const itemDate = new Date(item.date);
        return item.type === 'OUT' && item.excludeAnalysis !== 'Y' && itemDate.getFullYear() === year && itemDate.getMonth() === month;
      })
      .reduce((sum, item) => sum + item.amount, 0);
  }, [transactions, currentDate]);

  const renderTileContent = ({ date, view }) => {
    if (view === 'month' && date instanceof Date) {
      const dateStr = date.toLocaleDateString('en-CA');
      const dayData = transactions.filter(item => item.date === dateStr);
      const upcoming = upcomingFixedByDate[dateStr];
      if (dayData.length > 0 || upcoming) {
        const income = dayData.filter(i => i.type === 'IN').reduce((s, i) => s + i.amount, 0);
        const expense = dayData.filter(i => i.type === 'OUT').reduce((s, i) => s + i.amount, 0);
        const upcomingTotal = upcoming ? upcoming.reduce((s, u) => s + u.amount, 0) : 0;
        return (
          <div className="amount-container">
            {income > 0 && <div className="income-tag">+{fmtCompact(income)}</div>}
            {expense > 0 && <div className="expense-tag">-{fmtCompact(expense)}</div>}
            {upcomingTotal > 0 && <div className="fixed-preview-tag">-{fmtCompact(upcomingTotal)}</div>}
          </div>
        );
      }
    }
    return null;
  };

  // ---- 모달 열기/저장/삭제 ----
  const openView = (item) => { setSelectedItem(item); setModalType('view'); setIsModalOpen(true); };
  const openEdit = (e, item) => { e.stopPropagation(); setSelectedItem(item); setModalType('edit'); setIsModalOpen(true); };
  const openDelete = (e, item) => { e.stopPropagation(); setSelectedItem(item); setModalType('delete'); setIsModalOpen(true); };

  const handleSave = async (updated) => {
    if (!userId) { toast("로그인 정보가 없습니다.", { type: "error" }); return; }
    try {
      await transApi.updateTrans({
        transId: updated.id,
        title: updated.text,
        transDate: updated.date,
        originalAmount: Number(updated.amount),
        category: updated.category,
        type: updated.type,
        memo: updated.memo || '',
        userId: Number(userId),
        isShared: 'N',
        excludeAnalysis: updated.excludeAnalysis === 'Y' ? 'Y' : 'N',
      });
      toast("수정되었습니다.", { type: "success" });
      setIsModalOpen(false);
      fetchTransactions();
    } catch (err) {
      console.error(err);
      toast("수정 중 오류가 발생했습니다.", { type: "error" });
    }
  };

  const handleDelete = async (id) => {
    try {
      await transApi.deleteTrans(id);
      toast("삭제되었습니다.", { type: "success" });
      setIsModalOpen(false);
      fetchTransactions();
    } catch (err) {
      console.error(err);
      toast("삭제 중 오류가 발생했습니다.", { type: "error" });
    }
  };

  // ---- 캘린더 터치 스와이프로 월 이동 ----
  const touchStartRef = useRef({ x: 0, y: 0 });
  const SWIPE_THRESHOLD = 50; // 이 이상 가로로 움직여야 스와이프로 인정(오터치 방지)
  // 스와이프 방향에 따라 달력이 좌/우로 넘어가는 모션을 줄 때 쓰는 상태('next' | 'prev' | null)
  const [swipeDir, setSwipeDir] = useState(null);

  const handleCalendarTouchStart = (e) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleCalendarTouchEnd = (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    // 세로 스크롤과 헷갈리지 않도록 가로 이동이 세로 이동보다 뚜렷하게 클 때만 반응
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + (dx < 0 ? 1 : -1));
    setSwipeDir(dx < 0 ? 'next' : 'prev');
    setCurrentDate(next);
  };

  return (
    <main className="fade-in calendar-page-container">
      <div className="calendar-content-wrapper" style={{ display: 'flex', gap: '20px' }}>
        <div
          className="calendar-card"
          onTouchStart={handleCalendarTouchStart}
          onTouchEnd={handleCalendarTouchEnd}
        >
          <div
            key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
            className={`calendar-slide-wrap ${swipeDir ? `calendar-slide-${swipeDir}` : ''}`}
          >
            <Calendar
              onClickDay={(date) => { setSelectedDate(date.toLocaleDateString('en-CA')); setListMode('day'); }}
              tileContent={renderTileContent}
              formatDay={(locale, date) => date.getDate()}
              activeStartDate={currentDate}
              onActiveStartDateChange={({ activeStartDate }) => setCurrentDate(activeStartDate)}
              calendarType="gregory"
              tileClassName={getTileClassName}
              navigationLabel={({ label, view }) => (
                <span className="calendar-nav-label">
                  {label}
                  {/* 연/연대 보기로 드릴업했을 때는 "이번 달" 맥락이 안 맞으므로 월 보기에서만 표시 */}
                  {view === 'month' && (
                    <span className="calendar-nav-summary">
                      {' 총지출 '}
                      <strong>{monthlyTotalExpense.toLocaleString()}</strong>원
                    </span>
                  )}
                </span>
              )}
            />
          </div>
        </div>

        <div className="detail-card">
          <div className="ledger-head">
            <h3 className="detail-title">
              {listMode === 'day' ? `${fmtKoreanDate(selectedDate)} 내역` : `${currentDate.getMonth() + 1}월 전체`}
            </h3>
            <button type="button" className="ledger-add-btn" onClick={() => navigate('/mypage/expenseForm')}>
              + 추가
            </button>
          </div>

          <div className="ledger-toggle" role="group" aria-label="목록 범위">
            <button type="button" className={`ledger-toggle-btn ${listMode === 'day' ? 'active' : ''}`} onClick={() => setListMode('day')}>이 날</button>
            <button type="button" className={`ledger-toggle-btn ${listMode === 'month' ? 'active' : ''}`} onClick={() => setListMode('month')}>이 달 전체</button>
          </div>

          <input
            type="text"
            className="ledger-search"
            placeholder="내역 검색 (내용/카테고리)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {listMode === 'day' && upcomingFixedByDate[selectedDate] && (
            <div className="fixed-preview-notice">
              {upcomingFixedByDate[selectedDate].map((u, idx) => (
                <div key={idx} className="fixed-preview-row">
                  <span>{u.name} <span className="fixed-preview-badge">고정지출 예정</span></span>
                  <span className="fixed-preview-amt">-{u.amount.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          )}

          <div className="detail-list-container">
            {listItems.length > 0 ? (
              <ul className="detail-list">
                {listItems.map((item) => (
                  <li key={item.id} className="ledger-item">
                    <div className="ledger-item-main" onClick={() => openView(item)}>
                      <div className="ledger-item-title">
                        <span className="ledger-item-title-text">{item.text}</span>
                        {item.memo === FIXED_AUTO_MEMO && (
                          <span className="ledger-fixed-badge">고정지출</span>
                        )}
                        {item.excludeAnalysis === 'Y' && (
                          <span className="ledger-exclude-badge">분석 제외</span>
                        )}
                      </div>
                      <div className="ledger-item-sub">
                        {item.category}{listMode === 'month' ? ` · ${fmtKoreanDate(item.date)}` : ''}
                      </div>
                    </div>
                    <div className="ledger-item-right">
                      <div
                        className="ledger-item-amt"
                        style={{ color: item.type === 'IN' ? 'var(--income-color)' : 'var(--expense-color)' }}
                      >
                        {item.type === 'IN' ? '+' : '-'}{item.amount.toLocaleString()}원
                      </div>
                      <div className="ledger-item-actions">
                        <button type="button" onClick={(e) => openEdit(e, item)}>수정</button>
                        <button type="button" className="del" onClick={(e) => openDelete(e, item)}>삭제</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ledger-empty">
                {searchTerm.trim()
                  ? '검색 결과가 없어요.'
                  : (listMode === 'day' ? '이 날 등록된 내역이 없어요.' : '이 달 등록된 내역이 없어요.')}
              </p>
            )}
          </div>
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        type={modalType}
        transaction={selectedItem}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </main>
  );
}

export default CalendarView;
