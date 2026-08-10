import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../../api/authApi";
import styles from "./RegisterPage.module.css";
import { useFeedback } from "../../../context/FeedbackContext";

export default function SocialRegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useFeedback();

  
  const RULES = {
    loginId: {
      //  최소 하나의 영문자와 최소 하나의 숫자를 포함하는 8~16자 조합
      re: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,16}$/,
      msg: "영문과 숫자를 조합하여 8~16자로 입력해 주세요.",
    },
    nickName: {
      re: /^[가-힣]{3,5}$/,
      msg: "한글 3~5자로 입력해 주세요.",
    }
  };

  // LoginPage에서 전달한 카카오 정보 (이메일, 닉네임, 고유ID)
  const { kakaoEmail, kakaoNickname, providerUserId } = location.state || {};

  const [form, setForm] = useState({
    loginId: "",
    password: "",
    userName: kakaoNickname || "", // 이름 (소셜 정보, 읽기 전용)
    nickName: "", // 닉네임 (직접 입력, 중복체크 필요 — NICKNAME UNIQUE 제약)
    email: kakaoEmail || "",
    loginType : "KAKAO"
  });

  // 필드 에러 상태 관리
  const [fieldError, setFieldError] = useState({
    loginId: "",
    password: "",
    nickName: "",
  });

  // 상태 관리
  const [idCheck, setIdCheck] = useState(null);
  const [nickCheck, setNickCheck] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 개별 필드 검증 함수
  const validateField = (name, rawValue) => {
    const value = (rawValue ?? "").trim();
    if (name === "password") return value ? "" : "비밀번호를 입력해 주세요.";

    const rule = RULES[name];
    if (!rule) return "";
    if (!value) return rule.msg;

    return rule.re.test(value) ? "" : rule.msg;
  };

  // 데이터 없으면 입구컷 (이메일 동의항목 권한이 없어 kakaoEmail은 항상 비어있을 수 있으므로 providerUserId로 확인)
  useEffect(() => {
    if (!providerUserId) {
      toast("카카오 인증 정보가 없습니다. 다시 로그인해주세요.", { type: "error" });
      navigate("/login");
    }
  }, [providerUserId, navigate]);

  // 아이디 중복 체크 함수
  const handleCheckId = async () => {
    setError("");
    setIdCheck(null);

    const loginId = form.loginId.trim();
    if (!loginId) {
      setError("아이디를 입력해 주세요.");
      return;
    }

    // 중복체크 버튼 클릭 시에도 유효성 검사 수행
    const loginIdMsg = validateField("loginId", loginId);
    setFieldError((p) => ({ ...p, loginId: loginIdMsg }));
    if (loginIdMsg) return;

    try {
      const res = await authApi.checkId(loginId);
      const count = Number(res?.count ?? 0);
      setIdCheck({
        count,
        msg: count === 0 ? "사용 가능한 아이디입니다." : "이미 사용중인 아이디입니다.",
      });
    } catch (e) {
      setError("아이디 중복체크 실패");
    }
  };

  // 닉네임 중복 체크 함수
  const handleCheckNickName = async () => {
    setError("");
    setNickCheck(null);

    const nickName = form.nickName.trim();
    if (!nickName) {
      setError("닉네임을 입력해 주세요.");
      return;
    }

    const nickNameMsg = validateField("nickName", nickName);
    setFieldError((p) => ({ ...p, nickName: nickNameMsg }));
    if (nickNameMsg) return;

    try {
      const res = await authApi.checkNickName(nickName);
      const count = Number(res?.count ?? 0);
      setNickCheck({
        count,
        msg: count === 0 ? "사용 가능한 닉네임입니다." : "이미 사용중인 닉네임입니다.",
      });
    } catch (e) {
      setError("닉네임 중복체크 실패");
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setError("");
    if (name === "loginId") setIdCheck(null);
    if (name === "nickName") setNickCheck(null);

    // touched 조건 없이 입력 즉시 에러 상태 업데이트
    setFieldError((p) => ({
      ...p,
      [name]: validateField(name, value)
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 제출 시 최종 검사
    const nextFieldError = {
      loginId: validateField("loginId", form.loginId),
      password: validateField("password", form.password),
      nickName: validateField("nickName", form.nickName),
    };

    setFieldError(nextFieldError);

    const hasError = Object.values(nextFieldError).some(Boolean);
    if (hasError) {
      setError("입력값을 확인해 주세요.");
      return;
    }

    if (!idCheck || idCheck.count > 0) {
      setError("아이디 중복 확인을 완료해주세요.");
      return;
    }

    if (!nickCheck || nickCheck.count > 0) {
      setError("닉네임 중복 확인을 완료해주세요.");
      return;
    }

    const payload = {
      user : {
        loginId : form.loginId.trim(),
        password : form.password,
        userName : form.userName,
        nickName : form.nickName.trim(),
        email : form.email || null // 이메일 동의항목 권한이 없으면 빈 문자열 대신 null로 저장 (EMAIL UNIQUE 제약 충돌 방지)
      },
      loginType : form.loginType,
      providerUserId : providerUserId
    };

    setIsLoading(true);
    try {
      await authApi.register(payload);
      toast("카카오 계정 가입 완료!", { type: "success" });
      navigate("/login", { replace: true });
    } catch (err) {
      const msg = err?.data?.message || "가입 실패";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>

      <div style={{
        backgroundColor: "var(--warn-bg)",
        border: "1px solid var(--warn-border)",
        padding: "20px",
        borderRadius: "12px",
        marginBottom: "25px",
        fontSize: "14px",
        color: "var(--warn-text)",
        lineHeight: "1.7",
        textAlign: "left",
        boxShadow: "0 2px 8px var(--shadow-color)"
      }}>
        <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "10px", display: "flex", alignItems: "center" }}>
          💡 기존 계정과 연결하고 싶으신가요?
        </div>
        <ul style={{ margin: "0", paddingLeft: "18px", fontSize: "13.5px" }}>
          <li style={{ marginBottom: "5px" }}>
            <b>기존 계정을 쓰시려면:</b> 일반 로그인을 통해 접속한 후, 기존 계정을 <b>탈퇴</b>하고 현재 카카오 계정으로 다시 가입해 주세요.
          </li>
          <li style={{ marginBottom: "5px" }}>
            <b>새로 가입하시려면:</b> 아래 양식을 작성하여 가입을 완료해 주시면 됩니다.
          </li>
          <li>
            보안을 위해 가입 후에는 <b>이메일 변경이 불가능</b>하니 신중히 확인해 주세요.
          </li>
        </ul>
      </div>

      <h1 className={styles.title}>소셜 회원가입</h1>

      <form className={styles.form} onSubmit={onSubmit}>
        
        {/* 아이디 섹션 */}
        <div className={styles.labelRow}>
          <div className={styles.label}>아이디</div>
          <button className={styles.checkBtn} type="button" onClick={handleCheckId}>
            중복체크
          </button>
        </div>
        <input
          className={styles.input}
          name="loginId"
          value={form.loginId}
          onChange={onChange}
          placeholder="영어/숫자 8~16자로 입력해 주세요."
        />
        {/* ✅ touched 조건 제거: 에러가 있으면 즉시 빨간 글씨 노출 */}
        {fieldError.loginId ? (
          <div className={`${styles.hint} ${styles.bad}`}>{fieldError.loginId}</div>
        ) : (
          idCheck && (
            <div className={`${styles.hint} ${idCheck.count === 0 ? styles.ok : styles.bad}`}>
              {idCheck.msg}
            </div>
          )
        )}

        {/* 비밀번호 섹션 */}
        <div className={styles.label}>비밀번호</div>
        <input
          className={styles.input}
          type="password"
          name="password"
          value={form.password}
          onChange={onChange}
          placeholder="비밀번호를 입력해 주세요."
        />
        {fieldError.password && (
          <div className={`${styles.hint} ${styles.bad}`}>{fieldError.password}</div>
        )}

        {/* 닉네임 섹션 */}
        <div className={styles.labelRow}>
          <div className={styles.label}>닉네임</div>
          <button className={styles.checkBtn} type="button" onClick={handleCheckNickName}>
            중복체크
          </button>
        </div>
        <input
          className={styles.input}
          name="nickName"
          value={form.nickName}
          onChange={onChange}
          placeholder="한글 3~5자로 입력해 주세요."
        />
        {fieldError.nickName ? (
          <div className={`${styles.hint} ${styles.bad}`}>{fieldError.nickName}</div>
        ) : (
          nickCheck && (
            <div className={`${styles.hint} ${nickCheck.count === 0 ? styles.ok : styles.bad}`}>
              {nickCheck.msg}
            </div>
          )
        )}

        {/* 이름 (소셜 고정 정보) */}
        <div className={styles.label}>이름 (소셜 정보)</div>
        <input
          className={styles.input}
          style={{ backgroundColor: 'var(--surface-subtle)', color: 'var(--text-weak)' }}
          value={form.userName}
          readOnly
        />

        {/* 이메일 (소셜 고정 정보) — 카카오 이메일 동의항목 권한 승인 전까지는 항상 비어있으므로 값 있을 때만 노출 */}
        {kakaoEmail && (
          <>
            <div className={styles.label}>이메일 (소셜 정보)</div>
            <input
              className={styles.input}
              style={{ backgroundColor: 'var(--surface-subtle)', color: 'var(--text-weak)' }}
              value={form.email}
              readOnly
            />
          </>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submitBtn} type="submit" disabled={isLoading}>
          {isLoading ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <button className={styles.subBtn} type="button" onClick={() => navigate("/login")}>
        로그인으로 돌아가기
      </button>
    </div>
  );
}
