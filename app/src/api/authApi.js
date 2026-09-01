import { apiFetch } from "./http";

export const authApi = {
  // 이메일 + 비밀번호로 로그인 (로컬 계정). 카카오는 별도 콜백 흐름.
  login: (email, password) =>
    apiFetch("/user/login", { method: "POST", body: { email, password }, auth: false }),

  // 회원가입 1단계: 이메일로 인증코드 발송 (이미 가입된 이메일이면 409)
  sendEmailCode: (email) =>
    apiFetch("/user/email/send-code", { method: "POST", body: { email }, auth: false }),

  // 회원가입 2단계: 인증코드 확인 → 성공 시 { emailToken } 반환
  verifyEmailCode: ({ email, code }) =>
    apiFetch("/user/email/verify-code", { method: "POST", body: { email, code }, auth: false }),

  // 게스트 로그인 — 리뷰어 데모용, 자격증명 없이 미리 만들어둔 osori100 계정으로 즉시 로그인
  guestLogin: () =>
    apiFetch("/user/guest-login", { method: "POST", auth: false }),

  // 회원가입 3단계: 이메일 인증 토큰 + 이름 + 비밀번호로 계정 생성
  register: ({ emailToken, userName, password }) =>
    apiFetch("/user/register", {
      method: "POST",
      body: {
        emailToken,
        user: { userName, password },
        loginType: "LOCAL",
        providerUserId: null,
      },
      auth: false,
    }),

  // 비밀번호 재설정 1단계: 이메일로 인증코드 발송 (가입 계정 여부는 응답에 드러나지 않음)
  sendPasswordResetCode: (email) =>
    apiFetch("/user/password/send-code", { method: "POST", body: { email }, auth: false }),

  // 비밀번호 재설정 2단계: 인증코드 확인 → 성공 시 { resetToken }
  verifyPasswordResetCode: ({ email, code }) =>
    apiFetch("/user/password/verify-code", { method: "POST", body: { email, code }, auth: false }),

  // 비밀번호 재설정 3단계: 2단계에서 받은 resetToken + 새 비밀번호 전달
  resetPassword: ({ resetToken, newPassword }) =>
    apiFetch("/user/resetPassword", {
      method: "PATCH",
      body: { resetToken, newPassword },
      auth: false,
    }),

  logout: () => apiFetch("/user/logout", { method: "POST" }), // 로그아웃
};



