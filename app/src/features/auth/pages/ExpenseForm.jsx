import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ExpenseForm.css';
import transApi from '../../../api/transApi';
import nlParseApi from '../../../api/nlParseApi';
import installmentApi from '../../../api/installmentApi';
import { useAuth } from '../../../context/AuthContext';
import { IconReceipt, IconArrowUp, IconSparkle, IconBolt } from '../../../components/icons';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../constants/categories';
import { CategoryIcon } from '../../../components/icons/categoryIcons';
import { CURRENCIES, DEFAULT_CURRENCY, currencyMeta, isForeign } from '../../../constants/currencies';
import fxApi from '../../../api/fxApi';
import { useFeedback } from '../../../context/FeedbackContext';
import useCategories from '../../../hooks/useCategories';

// 문장 입력이 감이 안 잡히는 사용자를 위한 예시 — 탭하면 그대로 입력창에 채워진다.
const NL_EXPENSE_EXAMPLES = ['올리브영 마스크팩 2천원', '어제 친구랑 밥 3만원', '택시 12000원'];
const NL_INCOME_EXAMPLES = ['이번 달 월급 250만원', '용돈 10만원', '예금 이자 3200원'];

const ExpenseForm = () => {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nlText, setNlText] = useState('');
  // 문장 파싱 결과 미리보기. { result, apiType } — 저장/수정 버튼으로 확정하기 전 인라인으로 보여준다.
  const [nlParsed, setNlParsed] = useState(null);
  const [nlParsing, setNlParsing] = useState(false);
  // 지출 등록의 기본 화면은 AI 빠른 입력 — 영수증/직접 입력은 필요할 때만 펼친다.
  const [showManualEntry, setShowManualEntry] = useState(false);
  // 이 사용자가 자주/최근에 쓴 문장 — 있으면 정적 예시 대신 이걸 보여준다.
  const [personalExamples, setPersonalExamples] = useState([]);
  const fileInputRef = useRef(null);

  const getToday = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  };

  // PWA 홈 화면 바로가기(빠른 수입 입력)는 ?type=IN 으로 들어온다 → 처음부터 수입 모드로 시작.
  // (?quick=1 로 오는 빠른 지출 입력은 NL 입력창의 autoFocus로 이미 커서가 잡힌다.)
  const [formData, setFormData] = useState(() => {
    const startAsIncome = searchParams.get('type') === 'IN';
    return {
      type: startAsIncome ? '수입' : '지출',
      transDate: '',
      title: '',
      originalAmount: '',
      currency: DEFAULT_CURRENCY, // 'KRW'면 원화, 그 외면 originalAmount는 "외화 금액"
      category: (startAsIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0],
      memo: '',
      excludeAnalysis: 'N',
      installmentMonths: '' // 지출에서만 사용 — 2 이상이면 할부로 등록
    };
  });

  // 외화 입력 시 거래일 기준 환율(KRW per 1단위)과 그 메타. 원화면 null.
  const [fxRate, setFxRate] = useState(null);
  const [fxInfo, setFxInfo] = useState(null); // { rateDate, source, stale }
  const [fxLoading, setFxLoading] = useState(false);
  // 환산 원화값을 사용자가 직접 지정(카드 명세서 반영 등)하는 모드
  const [krwOverride, setKrwOverride] = useState(false);
  const [krwOverrideValue, setKrwOverrideValue] = useState('');

  const apiType = formData.type === '수입' ? 'IN' : 'OUT';
  const [currentCategories] = useCategories(user?.userId, apiType);

  useEffect(() => {
    if (!user?.userId) return;
    let cancelled = false;
    nlParseApi.getExamples({ userId: user.userId, type: apiType })
      .then((data) => { if (!cancelled) setPersonalExamples(data?.examples || []); })
      .catch(() => { if (!cancelled) setPersonalExamples([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, formData.type]);

  // 통화나 거래일이 바뀌면 환율을 다시 불러온다(원화면 초기화). 입력 중 과도한 호출을 막으려 200ms 디바운스.
  useEffect(() => {
    const foreign = isForeign(formData.currency);
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (!foreign) {
        setFxRate(null);
        setFxInfo(null);
        return;
      }
      setFxLoading(true);
      fxApi.rate(formData.currency, formData.transDate || getToday())
        .then((data) => {
          if (cancelled) return;
          setFxRate(Number(data?.rate) || null);
          setFxInfo({ rateDate: data?.rateDate, source: data?.source, stale: !!data?.stale });
        })
        .catch(() => { if (!cancelled) { setFxRate(null); setFxInfo(null); } })
        .finally(() => { if (!cancelled) setFxLoading(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.currency, formData.transDate]);

  const handleTypeToggle = (type) => {
    const newCategories = type === '수입' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setFormData({
      ...formData,
      type: type,
      transDate: '',
      category: newCategories[0],
      title: '',
      originalAmount: '',
      currency: DEFAULT_CURRENCY,
      memo: '',
      installmentMonths: ''
    });
    setKrwOverride(false);
    setKrwOverrideValue('');
    if (type === '수입') setPreviewUrl(null);
    // 탭을 바꾸면 항상 AI 빠른 입력 화면부터 다시 보여준다(수입/지출 둘 다 지원).
    setShowManualEntry(false);
    setNlText('');
    setNlParsed(null);
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

  // 외화 입력 시 환산 원화값(미리보기/저장용). fxRate가 아직 없으면 0.
  const foreignAmountNum = Number(formData.originalAmount) || 0;
  const computedKrw = fxRate ? Math.round(foreignAmountNum * fxRate) : 0;
  const effectiveKrw = krwOverride ? (Number(krwOverrideValue) || 0) : computedKrw;

  const handleNlTextChange = (e) => {
    setNlText(e.target.value);
    setNlParsed(null); // 문장을 다시 고치면 이전 미리보기는 지운다
  };

  const applyExample = (example) => {
    setNlText(example);
    setNlParsed(null);
  };

  // 파싱 결과를 그대로 저장(자동 저장 또는 원탭 확인 "저장" 선택 시). apiType: "IN" | "OUT"
  const saveParsedExpense = async (parsed, apiType) => {
    try {
      const title = parsed.merchant || parsed.memo || nlText;
      const parsedForeign = isForeign(parsed.currency);
      if (parsed.installmentMonths > 1 && !parsedForeign) {
        // "3개월 할부"처럼 인식되면 단건 저장 대신 N개월치 회차를 한 번에 등록 (외화 할부는 미지원 → 단건 저장)
        await installmentApi.register({
          userId: user?.userId,
          title,
          totalAmount: parsed.amount,
          installmentMonths: parsed.installmentMonths,
          startDate: parsed.date,
          category: parsed.category,
          memo: parsed.memo || nlText,
        });
      } else {
        await transApi.myTransSave({
          type: apiType,
          transDate: parsed.date,
          title,
          // 외화면 서버가 fxAmount+거래일 환율로 originalAmount(원화)를 재계산한다. parsed.amount는 표시용.
          originalAmount: parsed.amount,
          currency: parsedForeign ? parsed.currency : 'KRW',
          fxAmount: parsedForeign ? parsed.fxAmount : undefined,
          category: parsed.category,
          memo: parsed.memo || nlText,
          excludeAnalysis: 'N',
          userId: user?.userId,
        });
      }
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
      setNlParsed(null);
      navigate('/mypage/calendarView');
    } catch (error) {
      toast('저장 중 오류 발생', { type: 'error' });
    }
  };

  // 확신이 낮을 때 "수정" 선택 시 — 자동 저장하지 않고 아래 수동 폼에 미리 채워 사용자가 직접 확인/수정하게 함
  const applyParsedToManualForm = (parsed, apiType) => {
    const isIncome = apiType === 'IN';
    const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const parsedForeign = isForeign(parsed.currency);
    setFormData(prev => ({
      ...prev,
      type: isIncome ? '수입' : '지출',
      transDate: parsed.date || today,
      title: parsed.merchant || parsed.memo || nlText,
      // 외화면 수동 폼의 금액칸엔 "외화 금액"을, 통화 셀렉트엔 해당 통화를 채운다.
      originalAmount: (parsedForeign ? parsed.fxAmount : parsed.amount) || '',
      currency: parsedForeign ? parsed.currency : DEFAULT_CURRENCY,
      category: categories.includes(parsed.category) ? parsed.category : '기타',
      memo: parsed.memo || nlText,
      installmentMonths: parsedForeign ? '' : (parsed.installmentMonths || ''),
    }));
    setKrwOverride(false);
    setKrwOverrideValue('');
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

      // 파싱 결과는 모달 없이 입력창 아래 "카테고리 · 제목 · 금액" 미리보기로 보여주고,
      // 사용자가 [저장]/[수정]으로 확정한다(원화·외화 동일).
      setNlParsed({ result, apiType });
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

    const foreign = isForeign(formData.currency);

    if (foreign) {
      if (!fxRate) {
        toast("환율을 불러오는 중이에요. 잠시 후 다시 시도해주세요.", { type: "error" });
        return;
      }
      if (krwOverride && !(Number(krwOverrideValue) > 0)) {
        toast("직접 입력한 원화 금액을 확인해주세요.", { type: "error" });
        return;
      }
    }

    const installmentMonths = Number(formData.installmentMonths);
    const isInstallment = !foreign && formData.type === '지출' && Number.isInteger(installmentMonths) && installmentMonths > 1;
    if (formData.type === '지출' && foreign && Number.isInteger(installmentMonths) && installmentMonths > 1) {
      toast("외화 거래는 할부로 등록할 수 없어요. 개월수를 비워주세요.", { type: "error" });
      return;
    }
    if (isInstallment) {
      try {
        await installmentApi.register({
          userId: user?.userId,
          title: formData.title,
          totalAmount: Number(formData.originalAmount),
          installmentMonths,
          startDate: formData.transDate,
          category: formData.category,
          memo: formData.memo,
        });
        toast("할부로 등록되었습니다!", { type: "success" });
        navigate('/mypage/calendarView');
      } catch { toast("저장 중 오류 발생", { type: "error" }); }
      return;
    }

    try {
      const isIncome = formData.type === '수입';
      const transType = isIncome ? 'IN' : 'OUT';

      await transApi.myTransSave({
        transDate: formData.transDate,
        title: formData.title,
        // 외화면 서버가 fxAmount + 거래일 환율로 originalAmount(원화)를 확정한다.
        // krwOverride면 여기서 보낸 원화값을 그대로 저장한다.
        originalAmount: foreign ? effectiveKrw : formData.originalAmount,
        currency: foreign ? formData.currency : 'KRW',
        fxAmount: foreign ? Number(formData.originalAmount) : undefined,
        krwOverride: foreign ? krwOverride : undefined,
        category: formData.category,
        memo: formData.memo,
        excludeAnalysis: formData.excludeAnalysis,
        userId: user?.userId,
        type: transType,
      });
      toast("저장되었습니다!", { type: "success" });
      navigate('/mypage/calendarView');
    } catch { toast("저장 중 오류 발생", { type: "error" }); }
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
              <span className="nl-hero-eyebrow"><IconSparkle size={14} /> AI 빠른 입력</span>
              <h3 className="nl-hero-title">
                {formData.type === '수입' ? '이번 수입, 문장으로 말해보세요' : '이번 지출, 문장으로 말해보세요'}
              </h3>
              <p className="nl-hero-subtitle">
                {formData.type === '수입'
                  ? '금액·출처·날짜까지 AI가 알아서 채워드려요'
                  : '금액·카테고리·날짜까지 AI가 알아서 채워드려요'}
              </p>

              <div className={`nl-prompt-bar ${nlParsing ? 'is-busy' : ''}`}>
                <span className="nl-prompt-lead" aria-hidden="true"><IconSparkle size={20} /></span>
                <input
                  type="text"
                  className="nl-prompt-input"
                  placeholder={formData.type === '수입' ? '예: 이번 달 월급 250만원' : '예: 올리브영 마스크팩 2천원'}
                  value={nlText}
                  onChange={handleNlTextChange}
                  disabled={nlParsing}
                  autoFocus
                />
                <button
                  type="submit"
                  className="nl-prompt-send"
                  disabled={nlParsing || !nlText.trim()}
                  aria-label="등록"
                >
                  {nlParsing ? <span className="nl-prompt-spinner" /> : <IconArrowUp size={36} strokeWidth={3} color="#fff" />}
                </button>
              </div>

              {nlParsing && !nlParsed && (
                <div className="nl-reading" aria-live="polite">
                  <span className="nl-reading-dots"><i /><i /><i /></span>
                  AI가 문장을 읽고 있어요
                </div>
              )}

              {nlParsed && (() => {
                const p = nlParsed.result;
                const pForeign = isForeign(p.currency);
                const pTitle = p.merchant || p.memo || nlText;
                return (
                  <div className="nl-parsed-card">
                    <div className="nl-parsed-main">
                      <span className="nl-parsed-cat">{p.category}</span>
                      <span className="nl-parsed-dot">·</span>
                      <span className="nl-parsed-title">{pTitle}</span>
                      <span className="nl-parsed-dot">·</span>
                      <span className="nl-parsed-amt">{Number(p.amount).toLocaleString()}원</span>
                      {p.installmentMonths > 1 && (
                        <span className="nl-parsed-badge">{p.installmentMonths}개월 할부</span>
                      )}
                    </div>
                    {(pForeign || p.date !== today) && (
                      <div className="nl-parsed-sub">
                        {pForeign && (
                          <>
                            {currencyMeta(p.currency).symbol}{Number(p.fxAmount).toLocaleString()} {p.currency}
                            {' · '}1 {p.currency} = {Number(p.fxRate).toLocaleString()}원
                            {p.fxStale ? ' · 추정' : ''}
                          </>
                        )}
                        {pForeign && p.date !== today && ' · '}
                        {p.date !== today && p.date}
                      </div>
                    )}
                    <div className="nl-parsed-actions">
                      <button
                        type="button"
                        className="nl-parsed-btn nl-parsed-edit"
                        onClick={() => { applyParsedToManualForm(p, nlParsed.apiType); setNlParsed(null); }}
                      >수정</button>
                      <button
                        type="button"
                        className="nl-parsed-btn nl-parsed-save"
                        onClick={() => saveParsedExpense(p, nlParsed.apiType)}
                      >저장</button>
                    </div>
                  </div>
                );
              })()}

              <div className="nl-hero-examples">
                <span className="nl-hero-examples-label">
                  {personalExamples.length > 0 ? '자주 쓰는 문장' : '이렇게 말해보세요'}
                </span>
                <div className="nl-hero-example-chips">
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
                      <IconBolt size={12} />
                      {example}
                    </button>
                  ))}
                </div>
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
                className={`ocr-strip ${previewUrl ? 'has-preview' : ''}`}
                style={isLoading ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !isLoading && fileInputRef.current.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isLoading) fileInputRef.current.click(); }}
              >
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="업로드한 영수증 미리보기" className="ocr-strip-thumb" />
                    <span className="ocr-strip-text">영수증 인식됨 · 다시 올리기</span>
                  </>
                ) : (
                  <>
                    <IconReceipt size={20} />
                    <span className="ocr-strip-text">영수증으로 자동 채우기</span>
                    <span className="ocr-strip-hint">사진 선택 또는 드래그</span>
                  </>
                )}
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={onFileInput} />
              </div>
            )}

            <form className="expense-manual-form" onSubmit={handleSubmit}>
              {/* 금액 히어로 — 통화 선택 + 큰 숫자 입력 */}
              <div className="amount-hero">
                <div className="cur-seg" role="group" aria-label="통화 선택">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className={`cur-seg-btn ${formData.currency === c.code ? 'is-active' : ''}`}
                      aria-pressed={formData.currency === c.code}
                      onClick={() => setFormData(prev => ({ ...prev, currency: c.code }))}
                    >
                      <span className="cur-seg-sym">{c.symbol}</span>
                      {c.code === 'KRW' ? '원' : c.code}
                    </button>
                  ))}
                </div>
                <div className="amount-hero-row">
                  <span className="amount-hero-sym">{currencyMeta(formData.currency).symbol}</span>
                  <input
                    type="number"
                    name="originalAmount"
                    className="amount-hero-input"
                    placeholder="0"
                    value={formData.originalAmount}
                    onChange={handleChange}
                    min="0"
                    step="any"
                    inputMode="decimal"
                    required
                  />
                </div>

                {isForeign(formData.currency) && (
                  <div className="fx-preview">
                    {fxLoading && !fxRate ? (
                      <span className="fx-preview-loading">환율 불러오는 중…</span>
                    ) : fxRate ? (
                      <>
                        <div className="fx-preview-main">
                          ≈ <strong>{effectiveKrw.toLocaleString()}원</strong>
                          {krwOverride && <span className="fx-preview-tag">직접 입력</span>}
                          {!krwOverride && fxInfo?.stale && <span className="fx-preview-tag fx-preview-tag-warn">추정</span>}
                        </div>
                        <div className="fx-preview-sub">
                          1 {formData.currency} = {fxRate.toLocaleString()}원
                          {fxInfo?.rateDate ? ` · ${fxInfo.rateDate} 기준` : ''}
                        </div>
                        <label className="fx-override-toggle">
                          <input
                            type="checkbox"
                            checked={krwOverride}
                            onChange={(e) => {
                              setKrwOverride(e.target.checked);
                              if (e.target.checked && !krwOverrideValue) setKrwOverrideValue(String(computedKrw || ''));
                            }}
                          />
                          환산 금액을 직접 입력 (카드 명세서 반영 등)
                        </label>
                        {krwOverride && (
                          <div className="amount-wrapper">
                            <input
                              type="number"
                              className="input-field"
                              placeholder="0"
                              value={krwOverrideValue}
                              onChange={(e) => setKrwOverrideValue(e.target.value)}
                              min="0"
                            />
                            <span className="currency-unit">원</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="fx-preview-loading">환율을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</span>
                    )}
                  </div>
                )}
              </div>

              {/* 카테고리 — 아이콘 타일 그리드 */}
              <div className="cat-field">
                <span className="input-label">카테고리</span>
                <div className="cat-grid" role="group" aria-label="카테고리 선택">
                  {currentCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`cat-tile ${formData.category === cat ? 'is-active' : ''}`}
                      aria-pressed={formData.category === cat}
                      onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                    >
                      <span className="cat-tile-ico"><CategoryIcon name={cat} size={22} /></span>
                      <span className="cat-tile-label">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">{formData.type === '수입' ? '입금처 / 내용' : '거래처 / 가게명'}</label>
                <input type="text" name="title" className="input-field" placeholder={formData.type === '수입' ? "예: 회사, 부모님" : "예: 스타벅스, 식당"} value={formData.title} onChange={handleChange} required />
              </div>

              <div className="input-group">
                <label className="input-label">날짜</label>
                <input type="date" name="transDate" className="input-field" value={formData.transDate} onChange={handleChange} max={today}
                  onBlur={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (val > today) {
                      toast("미래 날짜는 등록할 수 없습니다.", { type: "error" });
                      setFormData(prev => ({ ...prev, transDate: today }));
                    }
                  }} required />
              </div>

              {formData.type === '지출' && !isForeign(formData.currency) && (
                <div className="input-group">
                  <label className="input-label">할부 개월수 <span className="input-label-hint">일시불이면 비워두세요</span></label>
                  <input
                    type="number"
                    name="installmentMonths"
                    className="input-field"
                    placeholder="2 이상"
                    value={formData.installmentMonths}
                    onChange={handleChange}
                    min="2"
                  />
                </div>
              )}

              <div className="input-group">
                <label className="input-label">메모 <span className="input-label-hint">선택</span></label>
                <textarea name="memo" className="input-field" placeholder="내용을 입력하세요" value={formData.memo} onChange={handleChange}></textarea>
              </div>

              <div className="exclude-toggle-row">
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
