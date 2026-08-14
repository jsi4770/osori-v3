import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./RegisterPage.module.css";
import { authApi } from "../../../api/authApi";
import { useFeedback } from "../../../context/FeedbackContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useFeedback();

  const RULES = {
    userName: {
      re: /^[가-힣]{3,5}$/,
      msg: "한글 3~5자로 입력해 주세요.",
    },
    nickName: {
      re: /^[가-힣]{3,5}$/,
      msg: "한글 3~5자로 입력해 주세요.",
    },
    email: {
      re: /^(?=.{10,20}$)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
      msg: "이메일 형식(@ 포함)으로 10~20자로 입력해 주세요.",
    },
  };

  const [form, setForm] = useState({
    password: "",
    userName: "",
    nickName: "",
    email: "",
  });

  const [fieldError, setFieldError] = useState({
    password: "",
    userName: "",
    nickName: "",
    email: "",
  });

  const [touched, setTouched] = useState({
    password: false,
    userName: false,
    nickName: false,
    email: false,
  });

  const [nickCheck, setNickCheck] = useState(null);
  const [emailCheck, setEmailCheck] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateField = (name, rawValue) => {
    const value = (rawValue ?? "").trim();

    if (name === "password") return value ? "" : "비밀번호를 입력해 주세요.";

    const rule = RULES[name];
    if (!rule) return "";
    if (!value) return rule.msg;

    return rule.re.test(value) ? "" : rule.msg;
  };

  const runDupCheck = async (field, rawValue) => {
    const value = (rawValue ?? "").trim();
    if (!value) return;

    try {
      if (field === "nickName") {
        const res = await authApi.checkNickName(value);
        const count = Number(res?.count ?? 0);
        setNickCheck({
          count,
          msg: count === 0 ? "사용 가능한 닉네임입니다." : "이미 사용중인 닉네임입니다.",
        });
      }

      if (field === "email") {
        const res = await authApi.checkEmail(value);
        const count = Number(res?.count ?? 0);
        setEmailCheck({
          count,
          msg: count === 0 ? "사용 가능한 이메일입니다." : "이미 사용중인 이메일입니다.",
        });
      }
    } catch (e) {}
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setError("");

    if (name === "nickName") setNickCheck(null);
    if (name === "email") setEmailCheck(null);

    if (touched[name]) {
      setFieldError((p) => ({ ...p, [name]: validateField(name, value) }));
    }
  };

  const onBlur = (e) => {
    const { name, value } = e.target;
    setTouched((p) => ({ ...p, [name]: true }));
    setFieldError((p) => ({ ...p, [name]: validateField(name, value) }));

    if (name === "nickName") {
      setNickCheck(null);
      const msg = validateField("nickName", value);
      if (!msg) void runDupCheck("nickName", value);
    }

    if (name === "email") {
      setEmailCheck(null);
      const msg = validateField("email", value);
      if (!msg) void runDupCheck("email", value);
    }
  };

  const canSubmit = useMemo(() => {
    return (
      form.password.trim() &&
      form.userName.trim() &&
      form.nickName.trim() &&
      form.email.trim()
    );
  }, [form]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const nextTouched = {
      password: true,
      userName: true,
      nickName: true,
      email: true,
    };

    const nextFieldError = {
      password: validateField("password", form.password),
      userName: validateField("userName", form.userName),
      nickName: validateField("nickName", form.nickName),
      email: validateField("email", form.email),
    };

    setTouched(nextTouched);
    setFieldError(nextFieldError);

    const hasError = Object.values(nextFieldError).some(Boolean);
    if (hasError) {
      setError("입력값을 확인해 주세요.");
      return;
    }

    if (!canSubmit) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }

    if (nickCheck && Number(nickCheck.count ?? 0) > 0) {
      setError("이미 사용중인 닉네임입니다.");
      return;
    }

    setIsLoading(true);
    try {
      const requestData = {
        user : {
          password : form.password,
          userName : form.userName.trim(),
          nickName : form.nickName.trim(),
          email : form.email.trim()
        },
        loginType : "LOCAL",
        providerUserId : null
      }

      await authApi.register(requestData);

      toast("회원가입 성공", { type: "success" });
      navigate("/login", { replace: true, state: { nickName: form.nickName.trim() }});
    } catch (e) {
      const msg = e?.data?.message || "회원가입 실패";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>회원가입</h1>

      <form className={styles.form} onSubmit={onSubmit}>
        {/* 비밀번호 */}
        <div className={styles.label}>비밀번호</div>
        <input
          className={styles.input}
          type="password"
          name="password"
          value={form.password}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="비밀번호를 입력해 주세요."
          autoComplete="new-password"
        />
        {touched.password && fieldError.password && (
          <div className={`${styles.hint} ${styles.bad}`}>{fieldError.password}</div>
        )}

        {/* 이름 */}
        <div className={styles.label}>이름</div>
        <input
          className={styles.input}
          name="userName"
          value={form.userName}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="한글 3~5자로 입력해 주세요."
        />
        {touched.userName && fieldError.userName && (
          <div className={`${styles.hint} ${styles.bad}`}>{fieldError.userName}</div>
        )}

        {/* 닉네임 — 아이디 대신 로그인에 사용됩니다 */}
        <div className={styles.label}>닉네임</div>
        <input
          className={styles.input}
          name="nickName"
          value={form.nickName}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="한글 3~5자, 로그인에 사용됩니다"
          autoComplete="username"
        />
        {touched.nickName && fieldError.nickName ? (
          <div className={`${styles.hint} ${styles.bad}`}>{fieldError.nickName}</div>
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

        {/* 이메일 */}
        <div className={styles.label}>이메일</div>
        <input
          className={styles.input}
          type="text"
          name="email"
          value={form.email}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="이메일 형식(@ 포함)으로 10~20자로 입력해 주세요."
          autoComplete="email"
        />
        {touched.email && fieldError.email ? (
          <div className={`${styles.hint} ${styles.bad}`}>{fieldError.email}</div>
        ) : (
          emailCheck && (
            <div
              className={`${styles.hint} ${
                Number(emailCheck.count ?? 0) === 0 ? styles.ok : styles.bad
              }`}
            >
              {emailCheck.msg}
            </div>
          )
        )}

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submitBtn} type="submit" disabled={isLoading}>
          {isLoading ? "가입 중..." : "회원가입"}
        </button>
      </form>

      <button className={styles.subBtn} type="button" onClick={() => navigate("/login")}>
        로그인으로
      </button>
    </div>
  );
}


