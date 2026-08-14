import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./SocialNicknamePage.module.css";
import { authApi } from "../../../api/authApi";
import { useAuth } from "../../../context/AuthContext";
import { useFeedback } from "../../../context/FeedbackContext";

const NICK_RE = /^[가-힣]{3,5}$/;

// 카카오 인증 직후, 자동가입 대신 이 화면에서 닉네임을 직접 정해야 가입이 완료된다.
// KakaoCallback이 isNewMember:true를 받으면 providerUserId/email/userName/suggestedNickName을
// state로 넘기며 이 페이지로 보낸다. 제출해야만 실제 계정이 생성된다(안 하면 미가입 상태로 남음).
export default function SocialNicknamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { toast } = useFeedback();

  const { providerUserId, email, userName, suggestedNickName } = location.state || {};

  // 카카오 인증 흐름을 거치지 않고 이 주소로 직접 들어온 경우 로그인 화면으로 돌려보낸다.
  useEffect(() => {
    if (!providerUserId) {
      navigate("/login", { replace: true });
    }
  }, [providerUserId, navigate]);

  const [nickName, setNickName] = useState(suggestedNickName || "");
  const [fieldError, setFieldError] = useState("");
  const [nickCheck, setNickCheck] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (value) => {
    const v = (value || "").trim();
    if (!v) return "닉네임을 입력해 주세요.";
    return NICK_RE.test(v) ? "" : "한글 3~5자로 입력해 주세요.";
  };

  const onChange = (e) => {
    setNickName(e.target.value);
    setNickCheck(null);
    setFieldError("");
  };

  const onBlur = async () => {
    const msg = validate(nickName);
    setFieldError(msg);
    if (msg) return;

    try {
      const res = await authApi.checkNickName(nickName.trim());
      const count = Number(res?.count ?? 0);
      setNickCheck({
        count,
        msg: count === 0 ? "사용 가능한 닉네임입니다." : "이미 사용중인 닉네임입니다.",
      });
    } catch {
      // 조용히 무시 — 최종 확인은 제출 시 서버가 다시 함
    }
  };

  const canSubmit = Boolean(nickName.trim()) && !fieldError && !isSubmitting;

  const onSubmit = async (e) => {
    e.preventDefault();

    const msg = validate(nickName);
    setFieldError(msg);
    if (msg) return;

    if (nickCheck && Number(nickCheck.count ?? 0) > 0) {
      setFieldError("이미 사용중인 닉네임입니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.completeKakaoRegistration({
        providerUserId,
        email,
        userName,
        nickName: nickName.trim(),
      });

      login(res);
      toast("회원가입이 완료되었습니다. 환영합니다!", { type: "success" });
      navigate("/mypage/assets", { replace: true });
    } catch (err) {
      setFieldError(err?.data?.message || "가입을 완료하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!providerUserId) return null;

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>닉네임을 정해주세요</h1>
      <p className={styles.subtitle}>
        카카오 인증이 완료됐어요.
        <br />
        앞으로 이 닉네임으로 로그인하게 됩니다.
      </p>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.label}>닉네임</div>
        <input
          className={styles.input}
          value={nickName}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="한글 3~5자로 입력해 주세요."
          autoFocus
        />
        {fieldError ? (
          <div className={`${styles.hint} ${styles.bad}`}>{fieldError}</div>
        ) : (
          nickCheck && (
            <div
              className={`${styles.hint} ${
                Number(nickCheck.count ?? 0) === 0 ? styles.ok : styles.bad
              }`}
            >
              {nickCheck.msg}
            </div>
          )
        )}

        <button className={styles.submitBtn} type="submit" disabled={!canSubmit}>
          {isSubmitting ? "가입 처리 중..." : "가입 완료"}
        </button>
      </form>
    </div>
  );
}
