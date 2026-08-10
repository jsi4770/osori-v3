import { createContext, useContext, useMemo, useState } from "react";
import { authApi } from "../api/authApi"; // [CHANGED] 로그아웃 API 호출하려고 추가
import React from "react"
import { useFeedback } from "./FeedbackContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { toast } = useFeedback();
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    // "undefined" 문자열이 들어오는 경우를 방지
    if (!raw || raw === "undefined") return null; // 2월 2일 추가 
    try {
      //return raw ? JSON.parse(raw) : null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!token;

  const login = ({ token: nextToken, user: nextUser }) => {
    // 값이 존재할 때만 저장하도록 방어
    if (nextToken) {
        localStorage.setItem("token", nextToken);
        setToken(nextToken);
    }
    if (nextUser) {
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
    }
  };

  const logout = async () => {
    // 서버 메시지 받고 띄우기 + 실패해도 로컬 로그아웃은 무조건 처리
    try {
      const data = await authApi.logout(); // 서버가 "로그아웃 되었습니다." 문자열을 내려줌

      // apiFetch는 content-type이 json이면 json, 아니면 text로 파싱함
     
      const message =
        typeof data === "string" && data.trim()
          ? data
          : data?.message || "로그아웃 되었습니다.";

      toast(message, { type: "success" });
    } catch (error) {
      toast("로그아웃 처리 중 오류가 발생했음 (그래도 로그아웃 처리함)", { type: "error" });
    } finally {
      // 여기서 로그아웃 완료(토큰/유저 제거)
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // 로그아웃하면 온보딩을 다시 볼 수 있도록 방문 기록 초기화
      localStorage.removeItem("osori_onboarded");
      setToken("");
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ token, user, isAuthenticated, login, logout, setUser }),
    [token, user, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
