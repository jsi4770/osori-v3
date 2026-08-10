import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./FindIdPage.module.css";
// [ADDED] 아이디 찾기 API 호출
import { authApi } from "../../../api/authApi";
import { useFeedback } from "../../../context/FeedbackContext";

export default function FindIdPage() {
  const navigate = useNavigate();
  const { toast } = useFeedback();

  // [BEFORE]
  // const [nickName, setNickName] = useState("");
  const [email, setEmail] = useState("");

  const [error, setError] = useState("");

  // [ADDED] 서버 응답 메시지/로딩
  const [serverMessage, setServerMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 간단 이메일 형식 체크(원하면 더 엄격하게 가능)
  //const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  // [ADDED] 위 라인이 주석이라 isValidEmail이 undefined로 터질 수 있어서 실제 함수 추가
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    // [ADDED] 이전 서버 메시지 초기화
    setServerMessage("");

    const em = email.trim();
    if (!em) {
      setError("이메일을 입력해 주세요.");
      return;
    }
    if (!isValidEmail(em)) {
      setError("이메일 형식이 올바르지 않습니다.");
      return;
    }

    // - 서버에서 { message, loginId } 같은 형태로 내려준다고 가정
    // - 매핑 주소는 authApi.findLoginIdByEmail 안에서 맞춰서 바꾸면 됨
    (async () => {
      try {
        setLoading(true);
        const data = await authApi.findLoginIdByEmail(em);
        const msg = data?.message || "요청이 완료되었습니다.";
        setServerMessage(msg);

        // 아이디를 같이 내려주면(정책에 따라) 토스트로 보여줌
        if (data?.loginId) {
          toast(`회원님의 아이디는 ${data.loginId}입니다.`, { type: "success" });
        }
      } catch (err) {
        const msg = err?.data?.message || err?.data || "아이디 찾기 요청에 실패했습니다.";
        setError(String(msg));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>아이디 찾기</h1>

      <form className={styles.form} onSubmit={onSubmit}>
        
        <div className={styles.label}>이메일</div>
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일을 입력해 주세요."
          autoComplete="email"
          inputMode="email"
        />

        {error && <div className={styles.error}>{error}</div>}

        {serverMessage && <div className={styles.ok}>{serverMessage}</div>}

        <button className={styles.submitBtn} type="submit" disabled={loading}>
          {loading ? "조회 중..." : "아이디 찾기"}
        </button>
      </form>

      <button className={styles.subBtn} type="button" onClick={() => navigate("/login")}>
        로그인으로
      </button>
    </div>
  );
}

