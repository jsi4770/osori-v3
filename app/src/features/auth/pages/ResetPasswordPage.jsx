import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./ResetPasswordPage.module.css";
import { authApi } from "../../../api/authApi";
import { useFeedback } from "../../../context/FeedbackContext";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useFeedback();

  // /find-password 에서 본인 확인 후 넘겨준 재설정 토큰 (닉네임이 아님)
  const resetToken = location.state?.resetToken || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");

  // 서버 응답 메시지/로딩
  const [serverMessage, setServerMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 토큰 없이 이 페이지에 직접 들어온 경우 → 1단계로 되돌린다.
  useEffect(() => {
    if (!resetToken) {
      navigate("/find-password", { replace: true });
    }
  }, [resetToken, navigate]);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
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

    // 재설정 토큰 + 새 비밀번호 -> 서버로 전송
    (async () => {
      try {
        setLoading(true);
        const data = await authApi.resetPassword({ resetToken, newPassword: pw1 });
        const msg = data?.message || data || "비밀번호가 재설정되었습니다.";
        setServerMessage(String(msg));

        toast(String(msg), { type: "success" });

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
