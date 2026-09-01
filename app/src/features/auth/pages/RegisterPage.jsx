import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./RegisterPage.module.css";
import { authApi } from "../../../api/authApi";
import { useFeedback } from "../../../context/FeedbackContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[가-힣]{2,10}$/;
const RESEND_COOLDOWN = 60; // 서버(app.mail.resend-cooldown-seconds)와 맞춤
const CODE_TTL = 300; // 서버(app.mail.code-ttl-seconds)와 맞춤 — 5분

const mmss = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useFeedback();

  // step 1: 이메일 입력 → 2: 인증코드 확인 → 3: 이름/비밀번호
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailToken, setEmailToken] = useState("");

  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [cooldown, setCooldown] = useState(0); // 재발송 쿨다운
  const [expiresIn, setExpiresIn] = useState(0); // 인증코드 남은 유효시간

  // step 2에 있는 동안 1초마다 쿨다운/유효시간을 함께 감소
  useEffect(() => {
    if (step !== 2) return;
    const id = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
      setExpiresIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  const sendCode = async () => {
    setError("");
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("올바른 이메일 형식으로 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await authApi.sendEmailCode(value);
      setEmail(value);
      setStep(2);
      setCode("");
      setCooldown(RESEND_COOLDOWN);
      setExpiresIn(CODE_TTL);
      toast("인증코드를 보냈습니다. 메일함을 확인해 주세요.", { type: "success" });
    } catch (e) {
      setError(e?.data?.message || e?.data || "인증코드 발송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError("");
    const value = code.trim();
    if (!/^\d{6}$/.test(value)) {
      setError("6자리 인증코드를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verifyEmailCode({ email, code: value });
      if (!res?.emailToken) {
        setError("인증에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      setEmailToken(res.emailToken);
      setStep(3);
    } catch (e) {
      setError(e?.data?.message || e?.data || "인증코드가 올바르지 않거나 만료되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!NAME_RE.test(userName.trim())) {
      setError("이름은 한글 2~10자로 입력해 주세요.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상으로 입력해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      await authApi.register({ emailToken, userName: userName.trim(), password });
      toast("회원가입 성공", { type: "success" });
      navigate("/login", { replace: true, state: { email } });
    } catch (e2) {
      setError(e2?.data?.message || e2?.data || "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>회원가입</h1>

      <div className={styles.hint} style={{ marginBottom: 14, color: "var(--text-sub)" }}>
        {step}/3 · {step === 1 ? "이메일 인증" : step === 2 ? "인증코드 확인" : "정보 입력"}
      </div>

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
            placeholder="이메일을 입력해 주세요."
            autoComplete="email"
          />
          <div className={styles.hint} style={{ color: "var(--text-sub)" }}>
            이 이메일이 로그인 아이디가 됩니다. 인증코드를 보내드려요.
          </div>

          {error && <div className={styles.error}>{error}</div>}

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
          <div className={styles.hint} style={{ color: "var(--text-sub)" }}>
            {email}로 보냈어요.<br />
            {expiresIn > 0 ? (
              <>
                5분 안에 입력해 주세요.{" "}
                <b style={{ color: "var(--primary-color)" }}>{mmss(expiresIn)}</b>
              </>
            ) : (
              <span className={styles.bad}>인증코드가 만료됐어요. ‘코드 다시 받기’를 눌러주세요.</span>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} type="submit" disabled={loading || expiresIn <= 0}>
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
              }}
            >
              이메일 다시 입력
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.label}>이메일</div>
          <input className={styles.input} value={email} readOnly disabled />

          <div className={styles.label}>이름</div>
          <input
            className={styles.input}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="한글 2~10자"
          />

          <div className={styles.label}>비밀번호</div>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            autoComplete="new-password"
          />

          <div className={styles.label}>비밀번호 확인</div>
          <input
            className={styles.input}
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="비밀번호를 한 번 더 입력해 주세요."
            autoComplete="new-password"
          />
          {password && passwordConfirm && (
            <div className={`${styles.hint} ${password === passwordConfirm ? styles.ok : styles.bad}`}>
              {password === passwordConfirm ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다."}
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>
      )}

      <button className={styles.subBtn} type="button" onClick={() => navigate("/login")}>
        로그인으로
      </button>
    </div>
  );
}
