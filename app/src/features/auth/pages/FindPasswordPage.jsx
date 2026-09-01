import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./FindPasswordPage.module.css";
import { authApi } from "../../../api/authApi";

export default function FindPasswordPage() {
  const navigate = useNavigate();

  const [nickName, setNickName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const [serverMessage, setServerMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    setServerMessage("");

    const nick = nickName.trim();
    const mail = email.trim();
    if (!nick || !mail) {
      setError("닉네임과 가입 시 등록한 이메일을 모두 입력해 주세요.");
      return;
    }
    if (!mail.includes("@")) {
      setError("이메일 형식(@ 포함)으로 입력해 주세요.");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const data = await authApi.requestPasswordReset({ nickName: nick, email: mail });
        const msg = data?.message || "본인 확인이 완료되었습니다.";
        setServerMessage(msg);

        // 닉네임이 아니라 서버가 발급한 재설정 토큰만 넘긴다.
        navigate("/reset-password", { state: { resetToken: data?.resetToken } });
      } catch (err) {
        const msg = err?.data?.message || err?.data || "본인 확인에 실패했습니다.";
        setError(String(msg));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>비밀번호 찾기</h1>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.label}>닉네임</div>
        <input
          className={styles.input}
          value={nickName}
          onChange={(e) => setNickName(e.target.value)}
          placeholder="닉네임을 입력해 주세요."
          autoComplete="username"
        />

        <div className={styles.label}>이메일</div>
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="가입 시 등록한 이메일을 입력해 주세요."
          autoComplete="email"
        />

        {error && <div className={styles.error}>{error}</div>}

        {serverMessage && <div className={styles.ok}>{serverMessage}</div>}

        <button className={styles.submitBtn} type="submit" disabled={loading}>
          {loading ? "확인 중..." : "다음"}
        </button>
      </form>

      <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: "var(--text-sub)" }}>
        카카오 로그인 계정은 비밀번호가 없어요. 로그인 화면에서 카카오로 로그인해 주세요.
      </div>

      <button className={styles.subBtn} type="button" onClick={() => navigate("/login")}>
        로그인으로
      </button>
    </div>
  );
}
