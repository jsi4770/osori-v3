import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "../components/ui";
import "./FeedbackContext.css";

const FeedbackContext = createContext(null);

const TOAST_ICON = { success: "✓", error: "!", info: "i" };

// alert()/window.confirm() 대체용 인앱 피드백. 네이티브 다이얼로그는 스타일링이 안 되고
// 메인 스레드를 막아 지금까지 다듬은 유리 재질·모션과 완전히 따로 놀아서,
// 토스트(비차단)와 확인 시트(차단이 필요한 삭제/로그아웃류)로 나눠 교체한다.
export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const idSeq = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const beginDismiss = useCallback((id) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => removeToast(id), 220);
  }, [removeToast]);

  const toast = useCallback((message, options = {}) => {
    if (!message) return;
    const { type = "info", duration = 3200 } = options;
    const id = ++idSeq.current;
    setToasts((list) => [...list, { id, message, type, leaving: false }]);
    window.setTimeout(() => beginDismiss(id), duration);
  }, [beginDismiss]);

  const confirm = useCallback((message, options = {}) => {
    const { danger = false, confirmLabel = "확인", cancelLabel = "취소" } = options;
    return new Promise((resolve) => {
      setConfirmState({ message, danger, confirmLabel, cancelLabel, resolve });
    });
  }, []);

  const closeConfirm = (result) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type} ${t.leaving ? "toast-leaving" : ""}`}
            onClick={() => beginDismiss(t.id)}
          >
            <span className="toast-icon" aria-hidden="true">{TOAST_ICON[t.type] || TOAST_ICON.info}</span>
            <span className="toast-text">{t.message}</span>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="confirm-scrim" onClick={() => closeConfirm(false)}>
          <div className="confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">{confirmState.message}</p>
            <div className="confirm-actions">
              <Button type="button" variant="subtle" block onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </Button>
              <Button
                type="button"
                variant={confirmState.danger ? "danger" : "primary"}
                block
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- Provider와 훅을 한 파일에 두는 기존 구조 유지(18곳에서 import)
export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback은 FeedbackProvider 안에서만 사용할 수 있습니다.");
  return ctx;
};
