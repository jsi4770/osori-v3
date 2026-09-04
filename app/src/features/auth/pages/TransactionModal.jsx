import React, { useState, useEffect } from "react";
import styles from "./MyAccountBook.module.css";
import { useAuth } from "../../../context/AuthContext";
import { useFeedback } from "../../../context/FeedbackContext";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../../../constants/categories";
import { currencyMeta, isForeign } from "../../../constants/currencies";
import useCategories from "../../../hooks/useCategories";

// 가계부 내역 보기/수정/삭제 공용 모달 (가계부·캘린더뷰에서 공유)
export default function TransactionModal({ isOpen, type, transaction, onClose, onSave, onDelete }) {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    text: "", amount: 0, date: "", category: "기타", memo: "", type: "OUT", excludeAnalysis: "N",
    currency: "KRW", fxAmount: null, fxRate: null, fxRateDate: null, fxRateSource: null,
  });

  const [currentCategories] = useCategories(user?.userId, formData.type);

  // type(부모가 준 초기 모드)을 내부 상태로 들고, 상세('view')에서 '수정'/'삭제'를 누르면 전환한다.
  // 부모가 열 때마다 key로 리마운트하므로 여는 시점의 type이 초기값이 된다.
  const [mode, setMode] = useState(type);

  useEffect(() => {
    if (transaction) {
      const transType = transaction.type || "OUT";
      setFormData({
        text: transaction.text,
        amount: Math.abs(transaction.amount),
        date: transaction.date,
        category: transaction.category,
        memo: transaction.memo || "",
        type: transType,
        excludeAnalysis: transaction.excludeAnalysis === "Y" ? "Y" : "N",
        currency: transaction.currency || "KRW",
        fxAmount: transaction.fxAmount ?? null,
        fxRate: transaction.fxRate ?? null,
        fxRateDate: transaction.fxRateDate ?? null,
        fxRateSource: transaction.fxRateSource ?? null,
      });
    }
  }, [transaction]);

  const foreign = isForeign(formData.currency);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "amount" && value < 0) {
      toast("금액은 0보다 커야 합니다.", { type: "error" });
      return;
    }
    if (name === "date" && value > today) {
      toast("미래 날짜는 선택할 수 없습니다.", { type: "error" });
      setFormData((prev) => ({ ...prev, [name]: today }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    const newCategories = newType === "IN" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setFormData((prev) => ({ ...prev, type: newType, category: newCategories[0] }));
  };

  const isViewMode = mode === "view";
  const isDetailMode = mode === "edit" || mode === "view";

  return (
    <div className={styles["modal-overlay"]} onClick={onClose}>
      <div className={styles["modal-content"]} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles["modal-close"]} onClick={onClose} aria-label="닫기">✕</button>
        {isDetailMode ? (
          <>
            <h3>{isViewMode ? "내역 상세" : "내역 수정"}</h3>

            <div className={styles["modal-radio-group"]}>
              <label className={styles["radio-label"]}>
                <input type="radio" name="type" value="IN" checked={formData.type === "IN"} onChange={handleTypeChange} disabled={isViewMode} />
                <span style={{ color: formData.type === "IN" ? "var(--income-color)" : "var(--text-weak)" }}>수입</span>
              </label>
              <label className={styles["radio-label"]}>
                <input type="radio" name="type" value="OUT" checked={formData.type === "OUT"} onChange={handleTypeChange} disabled={isViewMode} />
                <span style={{ color: formData.type === "OUT" ? "var(--expense-color)" : "var(--text-weak)" }}>지출</span>
              </label>
            </div>

            <div className={styles["modal-form"]}>
              <div>
                <label className={styles["modal-label"]}>날짜</label>
                <input
                  type="date" name="date" className={styles["modal-input"]}
                  value={formData.date} onChange={handleChange}
                  readOnly={isViewMode} disabled={isViewMode} max={today}
                  onBlur={(e) => {
                    if (e.target.value > today) {
                      toast("미래 날짜는 입력할 수 없습니다.", { type: "error" });
                      setFormData((prev) => ({ ...prev, date: today }));
                    }
                  }}
                />
              </div>
              <div>
                <label className={styles["modal-label"]}>내용</label>
                <input type="text" name="text" className={styles["modal-input"]} value={formData.text} onChange={handleChange} readOnly={isViewMode} />
              </div>
              <div>
                <label className={styles["modal-label"]}>금액{foreign ? " (원화)" : ""}</label>
                <input type="number" name="amount" className={styles["modal-input"]} value={formData.amount} onChange={handleChange} readOnly={isViewMode} min="0" />
                {foreign && (
                  <div style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--text-weak)", lineHeight: 1.5 }}>
                    원본 {currencyMeta(formData.currency).symbol}
                    {Number(formData.fxAmount ?? 0).toLocaleString()} {formData.currency}
                    {formData.fxRate ? ` · 1 ${formData.currency} = ${Number(formData.fxRate).toLocaleString()}원` : ""}
                    {formData.fxRateDate ? ` (${formData.fxRateDate} 기준)` : ""}
                    {formData.fxRateSource === "fallback" ? " · 추정" : ""}
                    {!isViewMode && <><br />금액칸을 고치면 그 원화 금액으로 저장돼요 (카드 명세서 반영 등).</>}
                  </div>
                )}
              </div>
              <div>
                <label className={styles["modal-label"]}>카테고리</label>
                {isViewMode ? (
                  <input type="text" name="category" className={styles["modal-input"]} value={formData.category} readOnly />
                ) : (
                  <select name="category" className={styles["modal-input"]} value={formData.category} onChange={handleChange}>
                    {currentCategories.map((cat, index) => (
                      <option key={index} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className={styles["modal-label"]}>메모</label>
                <input type="text" name="memo" className={styles["modal-input"]} value={formData.memo} onChange={handleChange} readOnly={isViewMode} placeholder={isViewMode ? "" : "메모를 입력하세요"} />
              </div>
            </div>

            <div className={styles["exclude-toggle-row"]}>
              <div className={styles["exclude-toggle-label"]}>
                <span className={styles["exclude-toggle-title"]}>분석에서 제외</span>
                <span className={styles["exclude-toggle-desc"]}>홈 그래프·AI 코칭 분석에 이 내역을 포함하지 않아요</span>
              </div>
              <label className={styles["toggle-switch"]}>
                <input
                  type="checkbox"
                  checked={formData.excludeAnalysis === "Y"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, excludeAnalysis: e.target.checked ? "Y" : "N" }))}
                  disabled={isViewMode}
                />
                <span className={styles["toggle-slider"]} />
              </label>
            </div>

            <div className={styles["modal-actions"]}>
              {isViewMode ? (
                <>
                  <button
                    className={`${styles["modal-btn"]} ${styles.delete}`}
                    onClick={() => setMode("delete")}
                  >삭제</button>
                  <button
                    className={`${styles["modal-btn"]} ${styles.confirm}`}
                    onClick={() => setMode("edit")}
                  >수정</button>
                </>
              ) : (
                <>
                  <button
                    className={`${styles["modal-btn"]} ${styles.cancel}`}
                    onClick={onClose}
                  >취소</button>
                  <button
                    className={`${styles["modal-btn"]} ${styles.confirm}`}
                    onClick={() => onSave({ ...transaction, ...formData, krwOverride: foreign })}
                  >저장</button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <h3>🗑️ 삭제 확인</h3>
            <p style={{ textAlign: "center", color: "var(--text-sub)", fontSize: "1rem", margin: "20px 0" }}>
              <strong>"{transaction?.text}"</strong> 내역을<br />정말 삭제하시겠습니까?
            </p>
            <div className={styles["modal-actions"]}>
              <button className={`${styles["modal-btn"]} ${styles.cancel}`} onClick={() => setMode("view")}>취소</button>
              <button className={`${styles["modal-btn"]} ${styles.delete}`} onClick={() => onDelete(transaction.id)}>삭제</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
