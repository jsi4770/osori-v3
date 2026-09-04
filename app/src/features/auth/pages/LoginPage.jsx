import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";
import { authApi } from "../../../api/authApi";
import { useAuth } from "../../../context/AuthContext";
import { useAppReady } from "../../../context/AppReadyContext";
import { useFeedback } from "../../../context/FeedbackContext";
import { Button } from "../../../components/ui";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { markReady } = useAppReady();
  const { toast } = useFeedback();

  // 로그인 화면은 기다릴 데이터가 없으므로 마운트 즉시 스플래시에 "준비됐다"고 알린다.
  useEffect(() => { markReady(); }, [markReady]);

  const REST_API_KEY = "0a83fd7608e0074b1c448e2add1f2632";
  const REDIRECT_URI = `${window.location.origin}/auth/kakao/callback`;
  const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&prompt=login`;

  const [form, setForm] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const pwRef = useRef(null);

  // 이메일 입력창에서 Enter → 곧바로 로그인하지 않고 비밀번호 입력창으로 포커스 이동.
  const onEmailKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      pwRef.current?.focus();
    }
  };

  useEffect(() => {
    const fromRegisterEmail = location.state?.email;
    const savedEmail = localStorage.getItem("savedEmail");

    if (fromRegisterEmail) {
      setForm((p) => ({ ...p, email: fromRegisterEmail }));
    } else if (savedEmail) {
      setForm((p) => ({ ...p, email: savedEmail, remember: true }));
    }

    const params = new URLSearchParams(location.search);
    if (params.get("auth") === "false") {
      toast("로그인 후 이용 가능한 서비스입니다.", { type: "info" });
      navigate("/login", { replace: true });
    }
  }, [location.state , location.search, navigate]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    const email = form.email.trim();
    const password = form.password;

    if (!email || !password) {
      toast("이메일과 비밀번호를 입력하세요.", { type: "error" });
      return;
    }

    try {
      const res = await authApi.login(email, password);

      //로그인 성공이면 token/user 저장부터 해야 PrivateRoute 통과가 안정적임
      login(res);

      if (res.token) {
        localStorage.setItem("token", res.token);
      }

      if (form.remember) localStorage.setItem("savedEmail", email);
      else localStorage.removeItem("savedEmail");

      const status = res?.user?.status;
      if (status === "H") {
        if (res?.message) toast(res.message, { type: "info" });
        navigate("/mypage/profileSettings", { replace: true });
        return;
      }

      // [기존] 정상(Y) 회원이면 마이페이지로(홈 탭이 활성화되도록 /mypage/assets 사용)
      navigate("/mypage/assets", { replace: true });
    } catch (e2) {
      const msg = e2?.data?.message || "로그인 실패";
      toast(msg, { type: "error" });
    }
  };

  const handleKakaoLogin = () => {
    window.location.href = KAKAO_AUTH_URL;
  };

  return (
    <div className={styles.wrap}>
      <Link to="/" className={styles.title}>
        OSORI
      </Link>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <div className={styles.label}>이메일</div>
          <input
            className={styles.input}
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            onKeyDown={onEmailKeyDown}
            placeholder="이메일"
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.label}>비밀번호</div>
          <input
            ref={pwRef}
            className={styles.input}
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            placeholder="비밀번호"
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" size="lg" pill block style={{ marginTop: 8 }}>
          로그인
        </Button>
      </form>

      <div className={styles.simpleArea}>
        <div className={styles.simpleTitle}>간편 로그인</div>

        <div className={styles.socialRow}>
          <button
            className={`${styles.socialBtn} ${styles.kakao}`}
            type="button"
            aria-label="카카오 로그인"
            onClick={handleKakaoLogin} // 함수 연결
          >
            <KakaoIcon />
          </button>
        </div>
      </div>

      <div className={styles.bottomRow}>
        <Button
          variant="secondary"
          size="md"
          pill
          block
          type="button"
          onClick={() => navigate("/find-password")}
        >
          비밀번호 찾기
        </Button>
        <Button
          variant="secondary"
          size="md"
          pill
          block
          type="button"
          onClick={() => navigate("/register")}
        >
          회원가입
        </Button>
      </div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3C6.477 3 2 6.58 2 11c0 2.84 1.86 5.34 4.65 6.77-.2.72-.73 2.6-.84 3.02-.1.38.14.38.3.27.13-.09 2.1-1.43 2.95-2.02.62.09 1.26.14 1.94.14 5.523 0 10-3.58 10-8S17.523 3 12 3z" />
    </svg>
  );
}
