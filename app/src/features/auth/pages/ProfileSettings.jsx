import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import { useFeedback } from "../../../context/FeedbackContext";
import { userApi } from "../../../api/userApi";
import CategoryManager from "./CategoryManager";
import BudgetSettings from "./BudgetSettings";
import { usePushNotifications } from "../../../hooks/usePushNotifications";
import { pushApi } from "../../../api/pushApi";
import "./MyPage.css";
import "./ProfileSettings.css";

function ProfileSettings() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const { pref: themePref, setTheme } = useTheme();
  const { toast, confirm } = useFeedback();
  const push = usePushNotifications();

  const [pushTesting, setPushTesting] = useState(false);

  const handleTogglePush = async () => {
    if (push.subscribed) {
      await push.disable();
      toast("알림을 껐어요.", { type: "info" });
    } else {
      await push.enable();
    }
  };

  const handleTestPush = async () => {
    setPushTesting(true);
    try {
      const res = await pushApi.test({ userId: user?.userId });
      toast(res?.message || "테스트 알림을 보냈어요.", {
        type: res?.sent ? "success" : "error",
      });
    } catch {
      toast("테스트 알림 전송에 실패했어요.", { type: "error" });
    } finally {
      setPushTesting(false);
    }
  };

  const THEME_OPTIONS = [
    { key: "light", label: "라이트" },
    { key: "dark", label: "다크" },
    { key: "system", label: "시스템" },
  ];

  // 서버(저장된) 기준 초기값. 식별자는 이메일이고, 표시 이름은 USER_NAME.
  const initial = useMemo(() => {
    const name = user?.userName || user?.name || "";
    const email = user?.email || "";
    const displayName = name || email || "회원";
    return { displayName, name, email };
  }, [user]);

  // 입력(draft) 상태: 저장 버튼 누르기 전까지는 서버/상단표시와 분리
  const [userName, setUserName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);

  // 서버 initial이 바뀌면(저장 성공 후 setUser 등) 입력값도 동기화
  useEffect(() => {
    setUserName(initial.name);
    setEmail(initial.email);
  }, [initial.name, initial.email]);

  const [fieldErrors, setFieldErrors] = useState({
    userName: "",
  });

  const [isPasswordEditing, setIsPasswordEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  // 현재 비밀번호 입력란 === 새 비밀번호 입력란이면 경고 문구 노출
  const isSamePw =
    (currentPassword || "").trim() !== "" &&
    (newPassword || "").trim() !== "" &&
    (currentPassword || "").trim() === (newPassword || "").trim();

  // 새 비밀번호 일치/불일치 메시지
  const [pwMatchMsg, setPwMatchMsg] = useState("");
  const [pwMatchOk, setPwMatchOk] = useState(null); // null | true | false

  //회원탈퇴 디자인(카드 + 모달) — 비밀번호 재확인 대신 탈퇴 사유 선택
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawChecked, setWithdrawChecked] = useState(false);

  const WITHDRAW_REASONS = [
    "자주 사용하지 않아서",
    "원하는 기능이 없어서",
    "오류/버그가 많아서",
    "사용법이 어려워서",
    "개인정보 보호가 걱정돼서",
    "기타",
  ];

  // 탈퇴 중 중복 클릭 방지(디자인 영향 없음)
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // 계정 정보(닉네임/이름/이메일/비밀번호)는 기본적으로 접어두고, "내 정보 보기"를 눌러야 펼쳐진다.
  const [showAccountDetails, setShowAccountDetails] = useState(false);

  const hasProfileChanges = userName !== initial.name;

  const hasPasswordChanges =
    isPasswordEditing && (currentPassword || newPassword || newPasswordConfirm);

  const canSave = hasProfileChanges || hasPasswordChanges;

  const hasFieldErrors = Boolean(fieldErrors.userName);

  // 휴면(H) 여부
  const isDormant = user?.status === "H";
  
  // 휴면(H)이면 변경사항 없어도 버튼 활성화
  const canSubmit = (canSave || isDormant) && !isSaving && !hasFieldErrors;

  const validate = () => {
    const trimmedUserName = (userName || "").trim();
    if (!trimmedUserName) return "이름을 입력해주세요.";
    if (trimmedUserName.length < 2) return "이름은 2글자 이상 입력해주세요.";

    if (isPasswordEditing) {
      if (!currentPassword.trim()) return "현재 비밀번호를 입력해야 합니다.";
      if (!newPassword.trim()) return "새 비밀번호를 입력해야 합니다.";
      if (newPassword.length < 8) return "새 비밀번호는 8자 이상 권장 합니다.";
      if (newPassword !== newPasswordConfirm) return "새 비밀번호 확인이 일치하지 않습니다.";
    }
    return "";
  };

  // 이름 blur 간단 검증(중복체크 API가 없다고 해서 프론트 최소검증만)
  const checkUserNameOnBlur = () => {
    const v = (userName || "").trim();
    const init = (initial.name || "").trim();

    // 비었으면(선택값) 에러 제거
    if (!v) {
      setFieldErrors((prev) => ({ ...prev, userName: "" }));
      return;
    }

    // 초기값으로 돌아온 경우 스킵
    if (v === init) {
      setFieldErrors((prev) => ({ ...prev, userName: "" }));
      return;
    }

    if (v.length < 2) {
      setFieldErrors((prev) => ({ ...prev, userName: "이름은 2글자 이상 입력해주세요." }));
      return;
    }

    setFieldErrors((prev) => ({ ...prev, userName: "" }));
  };

  const handleSave = async () => {
    const msg = validate();
    if (msg) {
      if (msg.includes("이름")) setFieldErrors((prev) => ({ ...prev, userName: msg }));
      toast(msg, { type: "error" });
      return;
    }

    if (hasFieldErrors) {
      toast("중복/형식 오류를 먼저 해결해야 함", { type: "error" });
      return;
    }

    const loginId = (user?.loginId || "").trim();
    if (!loginId) {
      toast("로그인 정보가 없습니다. 로그인을 다시 하셔야 합니다.", { type: "error" });
      return;
    }

    const formData = new FormData();
    formData.append("loginId", loginId);
    formData.append("userName", (userName || "").trim() || "");
    formData.append("status", user?.status || "");

    const mePayload = {
      loginId,
      userName: (userName || "").trim() || null,
      status: user?.status,
    };

    setIsSaving(true);
    setSaveError("");

    try {
      const res = await userApi.updateMe(formData);
      const serverMessage = res?.message; // 서버 message 사용

      let updatedUserFromServer = res?.user || res;

      if (!updatedUserFromServer || typeof updatedUserFromServer !== "object") {
        updatedUserFromServer = { ...(user || {}), ...mePayload };
      }

      setUser(updatedUserFromServer);
      localStorage.setItem("user", JSON.stringify(updatedUserFromServer));

      if (isPasswordEditing) {
        await userApi.changePassword({ currentPassword, newPassword });
      }

      //서버 메시지 우선
      toast(serverMessage || "저장 완료", { type: "success" });

      setIsPasswordEditing(false);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      
    } catch (err) {
      const message =
        err?.data?.message ||
        (typeof err?.data === "string" ? err.data : "저장 중 오류가 발생했습니다.");
      setSaveError(message);
      toast(message, { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // 로그아웃 진행 중 중복 클릭 방지
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 설정 탭 로그아웃: AuthContext.logout()이 서버 로그아웃 + 로컬 토큰/유저 정리까지 처리한다.
  const handleLogout = async () => {
    if (isLoggingOut) return;
    const ok = await confirm("로그아웃 하시겠습니까?");
    if (!ok) return;

    setIsLoggingOut(true);
    try {
      await logout();
      // "/"로 보내면 RootRedirect가 미온보딩 상태를 감지해 온보딩으로 안내
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 회원탈퇴 UX: 위험 카드 클릭 → 모달 열기
  const openWithdraw = () => {
    setWithdrawReason("");
    setWithdrawChecked(false);

    // 모달 열릴 때 탈퇴 진행 상태 초기화(디자인 영향 없음)
    setIsWithdrawing(false);

    setIsWithdrawOpen(true);
  };

  const closeWithdraw = () => setIsWithdrawOpen(false);

  const handleWithdraw = async () => {
    // 체크박스 체크 + 탈퇴 사유 선택 시에만 진행
    if (!withdrawChecked) return toast("탈퇴 안내를 확인하고 체크해야 함", { type: "error" });
    if (!withdrawReason) return toast("탈퇴 사유를 선택해야 함", { type: "error" });

    if (isWithdrawing) return;
    setIsWithdrawing(true);

    try {
      // 서버 ResponseEntity message 표시
      const res = await userApi.withdraw({ reason: withdrawReason });
      const serverMessage =
        res?.message || (typeof res === "string" ? res : "회원탈퇴 완료");
      toast(serverMessage, { type: "success" });

      await logout();
      navigate("/", { replace: true });
    } catch (err) {
      const message =
        err?.data?.message ||
        (typeof err?.data === "string" ? err.data : "회원탈퇴 중 오류가 발생했음");
      toast(message, { type: "error" });
    } finally {
      setIsWithdrawing(false);
      closeWithdraw();
    }
  };

  // 상단 프로필 표시는 "입력값(draft)"이 아니라 "서버 저장값(initial)"만
  const displayName = (initial.displayName || "회원").trim();
  const displayEmail = (initial.email || "").trim();

  // 휴면 계정은 해제 CTA를 놓치지 않도록 접힘 상태와 무관하게 항상 펼쳐서 보여준다.
  const accountDetailsVisible = showAccountDetails || isDormant;

  // 탈퇴 버튼 활성화 조건
  const canWithdraw = withdrawChecked && Boolean(withdrawReason) && !isWithdrawing;

  return (
    <main className="fade-in">
      <div className="ps-stack">
        {/* 계정: 프로필 + 이메일/비밀번호/소셜 연동을 하나의 카드로 통합 */}
        <section className="ps-section">
          <h2 className="ps-section-title">계정</h2>

          <div className="info-card ps-card ps-account-card">
            <div className="ps-profile-row">
              <div className="ps-profile-meta">
                <div className="ps-meta-name">{displayName}</div>
                <div className="ps-meta-email">{displayEmail}</div>
              </div>
              {!isDormant && (
                <button
                  type="button"
                  className="ps-link-btn ps-toggle-details-btn"
                  onClick={() => setShowAccountDetails((v) => !v)}
                >
                  {accountDetailsVisible ? "접기" : "내 정보 보기"}
                </button>
              )}
            </div>

            {accountDetailsVisible && (
              <>
            <div className="ps-form">
              <div className="ps-field">
                <label className="ps-label">이름</label>
                <input
                  className="ps-input"
                  value={userName}
                  onChange={(e) => {
                    setUserName(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, userName: "" }));
                  }}
                  onBlur={checkUserNameOnBlur}
                  placeholder="이름 입력"
                />
                {fieldErrors.userName && (
                  <div className="ps-field-error">{fieldErrors.userName}</div>
                )}
              </div>

              <div className="ps-field">
                <label className="ps-label">이메일</label>
                <input className="ps-input" value={email} readOnly disabled placeholder="이메일" />
                <div className="ps-help">로그인에 사용하는 이메일이에요. 변경이 필요하면 고객센터에 문의해 주세요.</div>
              </div>

              {user?.loginType === 'KAKAO' && (
                <div className="ps-field">
                  <div className="ps-row-between">
                    <label className="ps-label">계정 연동</label>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-sub)' }}>카카오 계정 연동 중</span>
                  </div>
                </div>
              )}

              {user?.loginType === 'KAKAO' ? (
                <div className="ps-field">
                  <label className="ps-label">비밀번호</label>
                  <div className="ps-help">
                    카카오 계정으로 로그인 중이에요. 비밀번호는 카카오에서 관리되며 이 화면에서는 변경할 수 없어요.
                  </div>
                </div>
              ) : (
              <div className="ps-field">
                <div className="ps-row-between">
                  <label className="ps-label">비밀번호</label>
                  <button
                    type="button"
                    className="ps-link-btn"
                    onClick={() => setIsPasswordEditing((v) => !v)}
                  >
                    {isPasswordEditing ? "닫기" : "비밀번호 변경"}
                  </button>
                </div>

                {isPasswordEditing && (
                  <div className="ps-password-box">
                    <div className="ps-field">
                      <label className="ps-label">현재 비밀번호</label>
                      <input
                        className="ps-input"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="현재 비밀번호"
                      />
                    </div>

                    <div className="ps-field">
                      <label className="ps-label">새 비밀번호</label>
                      <input
                        className="ps-input"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="새 비밀번호"
                      />

                      {isSamePw && (
                        <div className="ps-field-error">
                          현재 비밀번호와 일치합니다. 다른 비밀번호로 입력해주세요.
                        </div>
                      )}
                    </div>

                    <div className="ps-field">
                      <label className="ps-label">새 비밀번호 확인</label>
                      <input
                        className="ps-input"
                        type="password"
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        onBlur={(e) => {
                          const a = (newPassword || "").trim();
                          const b = (e.target.value || "").trim();

                          if (!b) {
                            setPwMatchMsg("");
                            setPwMatchOk(null);
                            return;
                          }

                          if (a === b) {
                            setPwMatchMsg("새 비밀번호와 일치합니다.");
                            setPwMatchOk(true);
                          } else {
                            setPwMatchMsg("새 비밀번호와 일치하지 않습니다.");
                            setPwMatchOk(false);
                          }
                        }}
                        placeholder="새 비밀번호 확인"
                      />
                      {pwMatchMsg && (
                        <div className={pwMatchOk ? "ps-help" : "ps-field-error"}>
                          {pwMatchMsg}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>

            <div className="ps-actions ps-actions-in-card">
              {saveError && <div className="ps-error">{saveError}</div>}
              <button
                type="button"
                className="ps-save-btn"
                onClick={handleSave}
                disabled={!canSubmit}
                style={
                  isDormant
                    ? { backgroundColor: "#2ecc71", borderColor: "#2ecc71" }
                    : undefined
                }
              >
                {isSaving
                  ? isDormant
                    ? "휴면 해제 중..."
                    : "저장 중..."
                  : isDormant
                  ? "휴면 해제"
                  : "저장"}
              </button>
            </div>
              </>
            )}
          </div>
        </section>

        {/* 환경설정: 화면 테마 등 앱 동작 방식에 관한 설정 */}
        <section className="ps-section">
          <h2 className="ps-section-title">환경설정</h2>

          <div className="info-card ps-theme">
            <div className="ps-theme-info">
              <div className="ps-theme-title">화면 테마</div>
              <div className="ps-theme-desc">
                라이트 · 다크 · 시스템 설정 중에서 선택할 수 있어요.
              </div>
            </div>
            <div className="ps-theme-seg" role="group" aria-label="화면 테마 선택">
              {THEME_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={`ps-theme-opt ${themePref === o.key ? "active" : ""}`}
                  aria-pressed={themePref === o.key}
                  onClick={() => setTheme(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 알림: 웹푸시(예산 초과, 소비 코치 넛지, 고정지출 예정, 매일 리포트 리마인더) */}
        <section className="ps-section">
          <h2 className="ps-section-title">알림</h2>

          <div className="info-card ps-theme">
            <div className="ps-theme-info">
              <div className="ps-theme-title">푸시 알림</div>
              <div className="ps-theme-desc">
                예산 초과, 소비 코치 넛지, 고정지출 결제 예정, 매일 저녁 소비 리포트 리마인더를
                기기 알림으로 받아요.
              </div>

              {!push.supported && (
                <div className="ps-field-error" style={{ marginTop: 8 }}>
                  이 브라우저는 푸시 알림을 지원하지 않습니다.
                </div>
              )}
              {push.supported && push.iosNeedsInstall && (
                <div className="ps-help" style={{ marginTop: 8 }}>
                  iPhone/iPad은 공유 → &quot;홈 화면에 추가&quot; 후 앱에서 열어야 알림을 켤 수 있어요.
                </div>
              )}
              {push.permission === "denied" && (
                <div className="ps-field-error" style={{ marginTop: 8 }}>
                  브라우저에서 알림이 차단돼 있어요. 사이트 설정에서 알림을 허용해주세요.
                </div>
              )}
              {push.error && (
                <div className="ps-field-error" style={{ marginTop: 8 }}>{push.error}</div>
              )}
            </div>

            <div className="ps-theme-seg" role="group" aria-label="푸시 알림 설정">
              <button
                type="button"
                className={`ps-theme-opt ${push.subscribed ? "active" : ""}`}
                aria-pressed={push.subscribed}
                disabled={
                  push.busy ||
                  !push.supported ||
                  push.iosNeedsInstall ||
                  push.permission === "denied"
                }
                onClick={handleTogglePush}
              >
                {push.busy ? "처리 중..." : push.subscribed ? "켜짐" : "꺼짐"}
              </button>
            </div>
          </div>

          {push.subscribed && (
            <button
              type="button"
              className="ps-link-btn"
              style={{ marginTop: 10 }}
              disabled={pushTesting}
              onClick={handleTestPush}
            >
              {pushTesting ? "보내는 중..." : "테스트 알림 보내기"}
            </button>
          )}
        </section>

        {/* 예산/저축 목표: 월 예산 + 저축 목표 금액/날짜/현재 저축액 */}
        <section className="ps-section">
          <h2 className="ps-section-title">예산 · 저축 목표</h2>
          <BudgetSettings />
        </section>

        {/* 카테고리 관리: 기본 카테고리 숨김/표시 + 커스텀 카테고리 추가/삭제 */}
        <section className="ps-section">
          <h2 className="ps-section-title">카테고리</h2>
          <CategoryManager />
        </section>

        {/* 계정 관리: 별도 카드/설명 없이 작은 텍스트 링크로만 노출 */}
        <div className="ps-account-links">
          <button
            type="button"
            className="ps-account-link"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
          <span className="ps-account-link-sep">·</span>
          <button type="button" className="ps-account-link" onClick={openWithdraw}>
            회원탈퇴
          </button>
        </div>
      </div>

      {isWithdrawOpen && (
        <div className="ps-modal-overlay" role="dialog" aria-modal="true">
          <div className="ps-modal">
            <div className="ps-modal-title">정말 탈퇴하시겠습니까?</div>
            <div className="ps-modal-text">
              탈퇴 시 계정 복구가 불가능합니다.
            </div>

            <div className="ps-field">
              <label className="ps-label">탈퇴 사유를 선택해주세요</label>
              <div className="ps-reason-grid">
                {WITHDRAW_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    className={`ps-reason-btn ${withdrawReason === reason ? "active" : ""}`}
                    onClick={() => setWithdrawReason(reason)}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <label className="ps-check">
              <input
                type="checkbox"
                checked={withdrawChecked}
                onChange={(e) => setWithdrawChecked(e.target.checked)}
              />
              <span>내용을 확인했습니다.</span>
            </label>

            <div className="ps-modal-actions">
              <button type="button" className="ps-btn" onClick={closeWithdraw}>
                취소
              </button>
              <button
                type="button"
                className="ps-btn danger"
                onClick={handleWithdraw}
                disabled={!canWithdraw}
              >
                탈퇴
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default ProfileSettings;