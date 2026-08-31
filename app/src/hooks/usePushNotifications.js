import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  isPushSupported,
  isIosSafari,
  isStandalone,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "../push/pushClient";

/**
 * 푸시 알림 구독 상태 + 켜기/끄기.
 * - supported: 브라우저 지원 여부
 * - iosNeedsInstall: iOS인데 아직 홈 화면 추가 전이라 불가능한 상태
 * - permission: Notification.permission 값
 * - subscribed: 현재 이 기기에 활성 구독이 있는지
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const userId = user?.userId;
  const supported = isPushSupported();
  const iosNeedsInstall = isIosSafari() && !isStandalone();

  const [permission, setPermission] = useState(
    supported ? Notification.permission : "unsupported"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    getExistingSubscription()
      .then((sub) => {
        if (!cancelled) setSubscribed(!!sub);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await subscribeToPush(userId);
      setPermission(Notification.permission);
      setSubscribed(true);
    } catch (e) {
      setError(e?.message || "알림을 켜지 못했습니다.");
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } catch (e) {
      setError(e?.message || "알림을 끄지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported,
    iosNeedsInstall,
    permission,
    subscribed,
    busy,
    error,
    enable,
    disable,
  };
}

export default usePushNotifications;
