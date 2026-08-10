import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ExpenseForm.css';
import transApi from '../../../api/transApi';
import nlParseApi from '../../../api/nlParseApi';
import { useAuth } from '../../../context/AuthContext';
import { IconReceipt } from '../../../components/icons';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../constants/categories';
import { useFeedback } from '../../../context/FeedbackContext';

// 문장 입력이 감이 안 잡히는 사용자를 위한 예시 — 탭하면 그대로 입력창에 채워진다.
const NL_EXPENSE_EXAMPLES = ['스타벅스 아메리카노 5천원', '어제 친구랑 밥 3만원', '택시 12000원'];
const NL_INCOME_EXAMPLES = ['이번 달 월급 250만원', '용돈 10만원', '예금 이자 3200원'];

const ExpenseForm = () => {
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();
  const navigate = useNavigate();

  const [currentCategories, setCurrentCategories] = useState(EXPENSE_CATEGORIES);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nlText, setNlText] = useState('');
  const [nlPreviewAmount, setNlPreviewAmount] = useState(null);
  const [nlParsing, setNlParsing] = useState(false);
  // 지출 등록의 기본 화면은 AI 빠른 입력 — 영수증/직접 입력은 필요할 때만 펼친다.
  const [showManualEntry, setShowManualEntry] = useState(false);
  // 이 사용자가 자주/최근에 쓴 문장 — 있으면 정적 예시 대신 이걸 보여준다.
  const [personalExamples, setPersonalExamples] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user?.userId) return;
    const apiType = formData.type === '수입' ? 'IN' : 'OUT';
    let cancelled = false;
    nlParseApi.getExamples({ userId: user.userId, type: apiType })
      .then((data) => { if (!cancelled) setPersonalExamples(data?.examples || []); })
      .catch(() => { if (!cancelled) setPersonalExamples([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, formData.type]);

  const getToday = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    type: '지출',
    transDate: '',
    title: '',
    originalAmount: '',
    category: EXPENSE_CATEGORIES[0],
    memo: '',
    excludeAnalysis: 'N'
  });

  const handleTypeToggle = (type) => {
    const newCategories = type === '수입' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setCurrentCategories(newCategories);
    setFormData({
      ...formData,
      type: type,
      transDate: '',
      category: newCategories[0],
      title: '',
      originalAmount: '',
      memo: ''
    });
    if (type === '수입') setPreviewUrl(null);
    // 탭을 바꾸면 항상 AI 빠른 입력 화면부터 다시 보여준다(수입/지출 둘 다 지원).
    setShowManualEntry(false);
    setNlText('');
    setNlPreviewAmount(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'originalAmount' && value < 0) {
      toast("금액은 음수를 입력할 수 없습니다.", { type: "error" });
      setFormData(prev => ({ ...prev, [name]: '' }));
      return;
    }

    if (name === 'transDate' && value) {
      const today = getToday();
      if (value > today) {
        toast("미래 날짜는 입력할 수 없습니다.", { type: "error" });
        setFormData(prev => ({ ...prev, [name]: today }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => { setIsDragging(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };
  const onFileInput = (e) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const formatDateString = (dateString) => {
    if (!dateString) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    try {
      const parts = dateString.split(/[\.\-\/\s년월일]+/).filter(part => part.trim() !== '');
      if (parts.length >= 3) {
        let year = parts[0].trim();
        if (year.length === 2) year = '20' + year;
        let month = parts[1].trim().padStart(2, '0');
        let day = parts[2].trim().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) { console.error(e); }
    return '';
  };

  const processFile = async (file) => {
    if (formData.type === '수입') return;
    if (isLoading) return; // OCR is metered/paid per call — never allow overlapping requests
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(file);
    const serverFormData = new FormData();
    serverFormData.append('receipt', file);
    setIsLoading(true);
    try {
      const data = await transApi.receiptAnalyze(serverFormData);
      if (data) {
        const { title, transDate, originalAmount, category } = data;
        const formattedDate = formatDateString(transDate);

        const today = getToday();
        let finalDate = formattedDate;

        if (formattedDate && formattedDate > today) {
          toast("미래 날짜는 등록할 수 없어 오늘 날짜로 변경되었습니다.", { type: "info" });
          finalDate = today;
        }
        setFormData(prev => ({
          ...prev,
          title: title || '',
          transDate: finalDate,
          originalAmount: originalAmount || '',
          category: EXPENSE_CATEGORIES.includes(category) ? category : '기타',
        }));
        toast("입력된 정보가 맞는지 확인해주세요", { type: "info" });
      }
    } catch (error) {
      const message = error?.response?.data?.message || "영수증 분석 실패";
      toast(`${message}\n직접 입력해주세요.`, { type: "error" });
    } finally { setIsLoading(false); }
  };

  const today = getToday();

  // 서버 왕복 전에 로컬에서 즉시 보여주는 낙관적 금액 미리보기 — 정식 파싱 결과가 아니라
  // "이 정도 금액으로 인식되고 있어요"라는 느낌만 먼저 준다(체감 지연 최소화 목적).
  const previewAmountFromText = (text) => {
    const manMatch = text.match(/(\d+(?:\.\d+)?)\s*만\s*(?:(\d+)\s*천)?\s*원?/);
    if (manMatch) {
      const man = parseFloat(manMatch[1]) * 10000;
      const cheon = manMatch[2] ? Number(manMatch[2]) * 1000 : 0;
      return Math.round(man + cheon);
    }
    const cheonMatch = text.match(/(\d+)\s*천\s*원?/);
    if (cheonMatch) return Number(cheonMatch[1]) * 1000;
    const wonMatch = text.match(/([\d,]+)\s*원/);
    if (wonMatch) return Number(wonMatch[1].replace(/,/g, ''));
    const bareMatch = text.match(/\d{1,3}(?:,\d{3})+/);
    if (bareMatch) return Number(bareMatch[0].replace(/,/g, ''));
    return null;
  };

  const handleNlTextChange = (e) => {
    const value = e.target.value;
    setNlText(value);
    setNlPreviewAmount(value.trim() ? previewAmountFromText(value) : null);
  };

  const applyExample = (example) => {
    setNlText(example);
    setNlPreviewAmount(previewAmountFromText(example));
  };

  // 파싱 결과를 그대로 저장(자동 저장 또는 원탭 확인 "저장" 선택 시). apiType: "IN" | "OUT"
  const saveParsedExpense = async (parsed, apiType) => {
    try {
      await transApi.myTransSave({
        type: apiType,
        transDate: parsed.date,
        title: parsed.merchant || parsed.memo || nlText,
        originalAmount: parsed.amount,
        category: parsed.category,
        memo: parsed.memo || nlText,
        excludeAnalysis: 'N',
        userId: user?.userId,
      });
      // merchant -> category 학습 + 예시 칩 개인화용 원문 기록. 저장 성공을 막지 않도록 실패해도 조용히 무시.
      nlParseApi.learn({
        userId: user?.userId,
        merchant: parsed.merchant,
        category: parsed.category,
        type: apiType,
        text: nlText,
      }).catch(() => {});
      toast('저장되었습니다!', { type: 'success' });
      setNlText('');
      setNlPreviewAmount(null);
      navigate('/mypage/calendarView');
    } catch (error) {
      toast('저장 중 오류 발생', { type: 'error' });
    }
  };

  // 확신이 낮을 때 "수정" 선택 시 — 자동 저장하지 않고 아래 수동 폼에 미리 채워 사용자가 직접 확인/수정하게 함
  const applyParsedToManualForm = (parsed, apiType) => {
    const isIncome = apiType === 'IN';
    const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setCurrentCategories(categories);
    setFormData(prev => ({
      ...prev,
      type: isIncome ? '수입' : '지출',
      transDate: parsed.date || today,
      title: parsed.merchant || parsed.memo || nlText,
      originalAmount: parsed.amount || '',
      category: categories.includes(parsed.category) ? parsed.category : '기타',
      memo: parsed.memo || nlText,
    }));
    setShowManualEntry(true);
  };

  const handleNlSubmit = async (e) => {
    e.preventDefault();
    const text = nlText.trim();
    if (!text || nlParsing) return;

    const apiType = formData.type === '수입' ? 'IN' : 'OUT';

    setNlParsing(true);
    try {
      const result = await nlParseApi.parse({ userId: user?.userId, text, type: apiType });

      if (!result.ok) {
        toast(result.message || '금액을 찾지 못했어요. 다시 입력해주세요.', { type: 'error' });
        return;
      }

      if (result.needsConfirmation) {
        const merchantPart = result.merchant ? `${result.merchant} · ` : '';
        const summary =
          `${merchantPart}${result.category} · ${Number(result.amount).toLocaleString()}원\n` +
          `${result.date}로 저장할까요?`;
        const ok = await confirm(summary, { confirmLabel: '저장', cancelLabel: '수정' });
        if (ok) {
          await saveParsedExpense(result, apiType);
        } else {
          applyParsedToManualForm(result, apiType);
          toast('아래에서 확인하고 저장해주세요.', { type: 'info' });
        }
      } else {
        await saveParsedExpense(result, apiType);
      }
    } catch (error) {
      toast(error?.response?.data?.message || '인식에 실패했어요. 직접 입력해주세요.', { type: 'error' });
    } finally {
      setNlParsing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.transDate || !formData.originalAmount || Number(formData.originalAmount) <= 0 || !formData.title) {
      toast("필수 입력 항목을 확인해주세요.", { type: "error" });
      return;
    }

    const inputDate = new Date(formData.transDate);
    const todayDate = new Date(getToday());

    if (inputDate > todayDate) {
      toast("[저장 실패] 미래 날짜는 저장할 수 없습니다.", { type: "error" });
      return;
    }

    try {
      const isIncome = formData.type === '수입';
      const transType = isIncome ? 'IN' : 'OUT';

      await transApi.myTransSave({ ...formData, userId: user?.userId, type: transType });
      toast("저장되었습니다!", { type: "success" });
      navigate('/mypage/calendarView');
    } catch (error) { toast("저장 중 오류 발생", { type: "error" }); }
  };

  return (
    <div className="expense-page-wrapper">
      <div className="expense-card">
        {isLoading && (
          <div className="loading-overlay"><div className="spinner"></div><p>영수증 분석 중입니다...</p></div>
        )}

        <div className="card-header">
          <h2 className="section-title">{formData.type === '수입' ? '수입 등록' : '지출 등록'}</h2>
          <div className="type-toggle-container">
            <button type="button" className={`type-btn ${formData.type === '수입' ? 'active income' : ''}`} onClick={() => handleTypeToggle('수입')}>수입</button>
            <button type="button" className={`type-btn ${formData.type === '지출' ? 'active expense' : ''}`} onClick={() => handleTypeToggle('지출')}>지출</button>
          </div>
        </div>

        {!showManualEntry && (
          <div className="nl-hero">
            <form className="nl-hero-form" onSubmit={handleNlSubmit}>
              <h3 className="nl-hero-title">
                {formData.type === '수입' ? '이번 수입, 문장으로 말해보세요' : '이번 지출, 문장으로 말해보세요'}
              </h3>
              <p className="nl-hero-subtitle">
                {formData.type === '수입'
                  ? '금액·출처·날짜까지 AI가 알아서 채워드려요'
                  : '금액·카테고리·날짜까지 AI가 알아서 채워드려요'}
              </p>

              <div className="nl-hero-input-row">
                <input
                  type="text"
                  className="nl-hero-input"
                  placeholder={formData.type === '수입' ? '예: 이번 달 월급 250만원' : '예: 스타벅스 아메리카노 5천원'}
                  value={nlText}
                  onChange={handleNlTextChange}
                  disabled={nlParsing}
                  autoFocus
                />
                <button
                  type="submit"
                  className="nl-hero-btn"
                  disabled={nlParsing || !nlText.trim()}
                >
                  {nlParsing ? '인식 중…' : '등록'}
                </button>
              </div>

              {nlPreviewAmount != null && (
                <div className="nl-hero-preview">{nlPreviewAmount.toLocaleString()}원 정도로 보여요…</div>
              )}

              <div className="nl-hero-examples">
                {(personalExamples.length > 0
                  ? personalExamples
                  : (formData.type === '수입' ? NL_INCOME_EXAMPLES : NL_EXPENSE_EXAMPLES)
                ).map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="nl-hero-example-chip"
                    onClick={() => applyExample(example)}
                    disabled={nlParsing}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </form>

            <button type="button" className="nl-manual-link" onClick={() => setShowManualEntry(true)}>
              {formData.type === '수입' ? '직접 입력할게요' : '영수증으로 등록하거나 직접 입력할게요'}
            </button>
          </div>
        )}

        {showManualEntry && (
          <>
            <button type="button" className="nl-manual-link nl-back-link" onClick={() => setShowManualEntry(false)}>
              ← AI로 빠르게 입력하기
            </button>

            {formData.type === '지출' && (
              <div
                className="ocr-upload-area"
                style={isLoading ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !isLoading && fileInputRef.current.click()}
              >
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Receipt Preview" className="preview-image" />
                    <div className="re-upload-overlay"><span>다시 올리기</span></div>
                  </>
                ) : (
                  <><div className="ocr-icon"><IconReceipt size={48} /></div><p className="ocr-text">영수증을 여기로 끌어오거나 클릭하세요</p></>
                )}
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={onFileInput} />
              </div>
            )}

            <form className="expense-manual-form" onSubmit={handleSubmit}>
              <div className="input-group"><label className="input-label">날짜</label><input type="date" name="transDate" className="input-field" value={formData.transDate} onChange={handleChange} max={today}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (val > today) {
                    toast("미래 날짜는 등록할 수 없습니다.", { type: "error" });
                    setFormData(prev => ({ ...prev, transDate: today }));
                  }
                }} required /></div>
              <div className="input-group"><label className="input-label">{formData.type === '수입' ? '입금처 / 내용' : '거래처 / 가게명'}</label><input type="text" name="title" className="input-field" placeholder={formData.type === '수입' ? "예: 회사, 부모님" : "예: 스타벅스, 식당"} value={formData.title} onChange={handleChange} required /></div>
              <div className="input-group"><label className="input-label">금액</label><div className="amount-wrapper"><input type="number" name="originalAmount" className="input-field" placeholder="0" value={formData.originalAmount} onChange={handleChange} min="0" required /><span className="currency-unit">원</span></div></div>
              <div className="input-group"><label className="input-label">카테고리</label><select name="category" className="input-field" value={formData.category} onChange={handleChange}>{currentCategories.map((cat, index) => <option key={index} value={cat}>{cat}</option>)}</select></div>
              <div className="input-group"><label className="input-label">메모</label><textarea name="memo" className="input-field" placeholder="내용을 입력하세요 (선택)" value={formData.memo} onChange={handleChange}></textarea></div>

              <div className="input-group exclude-toggle-row">
                <div className="exclude-toggle-label">
                  <span className="exclude-toggle-title">분석에서 제외</span>
                  <span className="exclude-toggle-desc">홈 그래프·AI 코칭 분석에 이 내역을 포함하지 않아요</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formData.excludeAnalysis === 'Y'}
                    onChange={(e) => setFormData(prev => ({ ...prev, excludeAnalysis: e.target.checked ? 'Y' : 'N' }))}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <button type="submit" className={`submit-btn ${formData.type === '지출' ? 'expense-mode' : ''}`}>
                {formData.type === '수입' ? '수입 등록하기' : '지출 등록하기'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ExpenseForm;
