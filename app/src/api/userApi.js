import { apiFetch } from "./http";

export const userApi = {
  
  checkNickName: (nickName) =>
    apiFetch(`/user/checkNickName?nickName=${encodeURIComponent(nickName)}`),

  checkEmail: (email) => apiFetch(`/user/checkEmail?email=${encodeURIComponent(email)}`),

  // 내 정보 수정 (닉네임/이름/이메일 등)
  updateMe: (payload) => apiFetch("/user/update", { method: "PATCH", body: payload }),

  // 비밀번호 변경
  changePassword: ({ currentPassword, newPassword }) =>
    apiFetch("/user/updatePassword", {
      method: "PATCH",
      body: { currentPassword, newPassword },
    }),

  // 회원탈퇴 — 비밀번호 재확인 대신 탈퇴 사유를 함께 보낸다(로그인 상태의 JWT로 신원 확인은 충분하다고 판단).
  withdraw: ({ reason }) =>
    apiFetch("/user/delete", {
      method: "DELETE",
      body: { reason },
    }),
};


