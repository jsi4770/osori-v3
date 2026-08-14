import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./FindPasswordPage.module.css";
import { authApi } from "../../../api/authApi";

export default function FindPasswordPage() {
  const navigate = useNavigate();

  const [nickName, setNickName] = useState("");
  const [error, setError] = useState("");

  const [serverMessage, setServerMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    setServerMessage("");

    const nick = nickName.trim();
    if (!nick) {
      setError("닉네임을 입력해 주세요.");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const data = await authApi.checkNicknameForReset(nick);
        const msg = data?.message || "확인이 완료되었습니다.";
        setServerMessage(msg);

        navigate("/reset-password", { state: { nickName: nick } });
      } catch (err) {
        const msg = err?.data?.message || err?.data || "닉네임 확인에 실패했습니다.";
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

        {error && <div className={styles.error}>{error}</div>}

        {/* [ADDED] 서버 응답 메시지 */}
        {serverMessage && <div className={styles.ok}>{serverMessage}</div>}

        <button className={styles.submitBtn} type="submit" disabled={loading}>
          {loading ? "확인 중..." : "다음"}
        </button>
      </form>

      <button className={styles.subBtn} type="button" onClick={() => navigate("/login")}>
        로그인으로
      </button>
    </div>
  );
}

