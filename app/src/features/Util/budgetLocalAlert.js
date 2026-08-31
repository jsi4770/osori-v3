// 앱이 열려 있는 동안 이번 달 지출이 월 예산을 넘으면 로컬 알림(SW showNotification)을 이번 달 1회만 띄운다.
// 서버 스케줄러(매일 20:00 푸시)와는 별개로, 사용자가 앱을 쓰는 도중 즉시 알려주기 위한 것.

export async function maybeNotifyBudgetExceeded({ monthSpent, budget }) {
  const spent = Number(monthSpent) || 0;
  const limit = Number(budget) || 0;
  if (limit <= 0 || spent <= limit) return;

  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;

  const ym = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const key = `osori_budget_alert_${ym}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    // localStorage 접근 불가 시엔 그냥 진행 (중복 가능성만 감수)
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("예산 초과 알림", {
      body: `이번 달 지출이 예산(${limit.toLocaleString()}원)을 넘었어요. 지금까지 ${spent.toLocaleString()}원 썼습니다.`,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "budget-overspend",
      renotify: true,
      data: { url: "/mypage/assets" },
    });
  } catch {
    /* noop */
  }
}
