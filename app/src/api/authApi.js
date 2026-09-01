import { apiFetch } from "./http";

export const authApi = {
  // "아이디" 개념 없이 닉네임+비밀번호로 로그인 (로컬/카카오 가입 모두 동일)
  login: (nickName, password) =>
    apiFetch("/user/login", { method: "POST", body: { nickName, password }, auth: false }),

  // 게스트 로그인 — 리뷰어 데모용, 자격증명 없이 미리 만들어둔 osori100 계정으로 즉시 로그인
  guestLogin: () =>
    apiFetch("/user/guest-login", { method: "POST", auth: false }),

  register: (data) =>
    apiFetch("/user/register", {
      method: "POST",
      body: data,
      auth: false,
    }),

  //닉네임 중복 체크
  checkNickName: (nickName) =>
    apiFetch(`/user/checkNickName?nickName=${encodeURIComponent(nickName)}`, { auth: false }),

  //이메일 중복 체크
  checkEmail: (email) =>
    apiFetch(`/user/checkEmail?email=${encodeURIComponent(email)}`, { auth: false }),

  // 비밀번호 찾기 1단계: 닉네임 + 등록된 이메일이 같은 계정에서 일치해야 통과.
  // 성공 시 { resetToken } 을 돌려받고, 이 토큰으로만 2단계를 진행한다.
  requestPasswordReset: ({ nickName, email }) =>
    apiFetch("/user/findPassword", { method: "POST", body: { nickName, email }, auth: false }),

  // 비밀번호 재설정 2단계: 1단계에서 받은 resetToken + 새 비밀번호 전달
  resetPassword: ({ resetToken, newPassword }) =>
    apiFetch("/user/resetPassword", {
      method: "PATCH",
      body: { resetToken, newPassword },
      auth: false,
    }),

  logout: () => apiFetch("/user/logout", { method: "POST" }), // 로그아웃

  // 카카오 신규가입 마무리 — 닉네임 확정 화면에서 제출
  completeKakaoRegistration: ({ providerUserId, email, userName, nickName }) =>
    apiFetch("/user/kakao/complete-registration", {
      method: "POST",
      body: { providerUserId, email, userName, nickName },
      auth: false,
    }),
};



