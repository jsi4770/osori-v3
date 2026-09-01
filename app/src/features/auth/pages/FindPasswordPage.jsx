import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./FindPasswordPage.module.css";
import { authApi } from "../../../api/authApi";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN = 60;

export default function FindPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: 이메일 입력, 2: 인증코드 확인
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [cooldown]);

  const sendCode = async () => {
    setError("");
    setServerMessage("");
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("올바른 이메일 형식으로 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.sendPasswordResetCode(value);
      setEmail(value);
      setStep(2);
      setCode("");
      setCooldown(RESEND_COOLDOWN);
      setServerMessage(typeof data === "string" ? data : data?.message || "인증코드를 보냈습니다.");
    } catch (err) {
      setError(err?.data?.message || err?.data || "인증코드 발송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError("");
    setServerMessage("");
    const value = code.trim();
    if (!/^\d{6}$/.test(value)) {
      setError("6자리 인증코드를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.verifyPasswordResetCode({ email, code: value });
      if (!data?.resetToken) {
        setError("인증에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      navigate("/reset-password", { state: { resetToken: data.resetToken } });
    } catch (err) {
      setError(err?.data?.message || err?.data || "인증코드가 올바르지 않거나 만료되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>비밀번호 찾기</h1>

      {step === 1 && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <div className={styles.label}>이메일</div>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="가입한 이메일을 입력해 주세요."
            autoComplete="email"
          />

          {error && <div className={styles.error}>{error}</div>}
          {serverMessage && <div className={styles.ok}>{serverMessage}</div>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? "보내는 중..." : "인증코드 받기"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            verifyCode();
          }}
        >
          <div className={styles.label}>인증코드</div>
          <input
            className={styles.input}
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="메일로 받은 6자리 숫자"
            autoComplete="one-time-code"
          />
          <div className={styles.hint} style={{ color: "var(--text-sub)", fontWeight: 700 }}>
            {email}로 보냈어요 (가입된 계정인 경우). 5분 안에 입력해 주세요.
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {serverMessage && <div className={styles.ok}>{serverMessage}</div>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? "확인 중..." : "확인"}
          </button>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              className={styles.subBtn}
              type="button"
              disabled={loading || cooldown > 0}
              onClick={sendCode}
            >
              {cooldown > 0 ? `코드 다시 받기 (${cooldown}s)` : "코드 다시 받기"}
            </button>
            <button
              className={styles.subBtn}
              type="button"
              onClick={() => {
                setStep(1);
                setError("");
                setServerMessage("");
              }}
            >
              이메일 다시 입력
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: "var(--text-sub)" }}>
        카카오 로그인 계정은 비밀번호가 없어요. 로그인 화면에서 카카오로 로그인해 주세요.
      </div>

      <button className={styles.subBtn} type="button" onClick={() => navigate("/login")}>
        로그인으로
      </button>
    </div>
  );
}
