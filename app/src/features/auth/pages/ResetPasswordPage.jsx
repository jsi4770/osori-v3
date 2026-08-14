import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./ResetPasswordPage.module.css";
import { authApi } from "../../../api/authApi";
import { useFeedback } from "../../../context/FeedbackContext";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useFeedback();

  // /find-password 에서 넘겨준 닉네임 (필요 없으면 화면에서 숨겨도 됨)
  const nickName = location.state?.nickName || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");

  // 서버 응답 메시지/로딩
  const [serverMessage, setServerMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    // 이전 서버 메시지 초기화
    setServerMessage("");

    const pw1 = newPassword.trim();
    const pw2 = confirmNewPassword.trim();

    if (!pw1 || !pw2) {
      setError("새 비밀번호와 새 비밀번호 확인을 모두 입력해 주세요.");
      return;
    }

    if (pw1.length < 8) {
      setError("비밀번호는 8자 이상으로 입력해 주세요.");
      return;
    }

    if (pw1 !== pw2) {
      setError("새 비밀번호와 새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    // 닉네임 + 새 비밀번호 -> 서버로 전송
    (async () => {
      try {
        setLoading(true);
        const data = await authApi.resetPassword({ nickName, newPassword: pw1 });
        const msg = data?.message || "비밀번호가 재설정되었습니다.";
        setServerMessage(msg);

        // 서버 정책에 따라 성공 메시지를 토스트로도 보여주고 싶으면 여기서 처리
        toast(msg, { type: "success" });

        navigate("/login");
      } catch (err) {
        const msg = err?.data?.message || err?.data || "비밀번호 재설정에 실패했습니다.";
        setError(String(msg));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>비밀번호 재설정</h1>

      <form className={styles.form} onSubmit={onSubmit}>
        
        <div className={styles.label}>새 비밀번호</div>
        <input
          className={styles.input}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="새 비밀번호를 입력해 주세요."
          autoComplete="new-password"
        />

        <div className={styles.label}>새 비밀번호 확인</div>
        <input
          className={styles.input}
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="새 비밀번호를 한 번 더 입력해 주세요."
          autoComplete="new-password"
        />
        
        {newPassword.trim() && confirmNewPassword.trim() && (
          newPassword.trim() === confirmNewPassword.trim() ? (
            <div className={styles.ok}>새 비밀번호와 일치합니다.</div>
          ) : (
            <div className={styles.error}>새 비밀번호가 일치하지 않습니다. 다시 입력해 주세요.</div>
          )
        )}


        {error && <div className={styles.error}>{error}</div>}

        {serverMessage && <div className={styles.ok}>{serverMessage}</div>}

        <button className={styles.submitBtn} type="submit" disabled={loading}>
          {loading ? "처리 중..." : "비밀번호 재설정"}
        </button>
      </form>

      <button className={styles.subBtn} type="button" onClick={() => navigate("/login")}>
        로그인으로
      </button>
    </div>
  );
}
