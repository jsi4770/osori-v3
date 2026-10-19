import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import notificationApi from "../api/notificationApi";

const NotificationContext = createContext({ unreadCount: 0, setUnreadCount: () => {}, refresh: () => {} });

const POLL_MS = 60_000;

// 안 읽은 알림 개수(사이드바/상단바 뱃지)를 로그인 영역 전체에서 공유한다.
// 1분마다, 그리고 탭으로 돌아올 때 갱신한다.
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.userId;
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setUnreadCount(await notificationApi.unreadCount(userId));
    } catch {
      /* 뱃지는 부가 정보 — 실패해도 조용히 둔다 */
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const value = useMemo(() => ({ unreadCount, setUnreadCount, refresh }), [unreadCount, refresh]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
