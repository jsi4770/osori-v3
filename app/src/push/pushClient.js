import { pushApi } from "../api/pushApi";

// VAPID 공개키(base64url) → pushManager.subscribe()가 요구하는 Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iOS/iPadOS는 "홈 화면에 추가"된 PWA(standalone)에서만 푸시가 동작한다.
export function isIosSafari() {
  const ua = window.navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// 권한 요청 → 구독 생성 → 서버 저장. 성공 시 PushSubscription 반환.
export async function subscribeToPush(userId) {
  if (!isPushSupported()) {
    throw new Error("이 브라우저는 푸시 알림을 지원하지 않습니다.");
  }
  if (isIosSafari() && !isStandalone()) {
    throw new Error("iOS에서는 먼저 '홈 화면에 추가'한 뒤 알림을 켤 수 있어요.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 허용되지 않았습니다.");
  }

  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();

  if (!subscription) {
    const { publicKey } = await pushApi.vapidPublicKey();
    if (!publicKey || publicKey.startsWith("CHANGE")) {
      throw new Error("서버에 푸시 키가 아직 설정되지 않았습니다.");
    }
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await pushApi.subscribe({ userId, subscription: subscription.toJSON() });
  return subscription;
}

export async function unsubscribeFromPush() {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  try {
    await pushApi.unsubscribe({ endpoint: subscription.endpoint });
  } catch {
    /* 서버 실패해도 로컬 구독은 해지한다 */
  }
  await subscription.unsubscribe();
}
