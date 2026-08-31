// OSORI 커스텀 서비스워커 (vite-plugin-pwa: injectManifest 모드)
// - 프리캐시/오프라인: workbox
// - 서버 웹푸시 수신 → 알림 표시
// - 알림 클릭 → 해당 화면으로 포커스/이동

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

// registerType: 'autoUpdate' 대응 — 새 SW를 즉시 활성화
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// vite-plugin-pwa가 빌드시 주입하는 프리캐시 목록
precacheAndRoute(self.__WB_MANIFEST);

// 재무 데이터 API는 절대 캐시하지 않는다 (오래된 잔액/코칭 데이터 노출 방지) — 기존 vite.config 규칙 이식.
// API 오리진은 빌드 시점의 VITE_API_BASE_URL에서 뽑아 하드코딩 URL이 어긋나지 않도록 한다.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/fincoach";
let apiOrigin = "";
try {
  apiOrigin = new URL(API_BASE, self.location.origin).origin;
} catch {
  apiOrigin = "";
}

registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/fincoach") ||
    (apiOrigin && url.origin === apiOrigin),
  new NetworkOnly()
);

// ── 서버 푸시 수신 ─────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "OSORI";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "osori",
    renotify: true,
    data: { url: data.url || "/mypage/assets" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── 알림 클릭 → 앱 열기/포커스 ─────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath =
    (event.notification.data && event.notification.data.url) || "/mypage/assets";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // 이미 열려 있는 탭이 있으면 그 탭으로
      for (const client of allClients) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(targetPath);
            }
            return;
          } catch {
            /* 아래 openWindow로 폴백 */
          }
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetPath);
      }
    })()
  );
});
