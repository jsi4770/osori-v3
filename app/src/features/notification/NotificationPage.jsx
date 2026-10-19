import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import notificationApi from "../../api/notificationApi";
import PageHeader from "../../components/ui/PageHeader";
import { IconBell, IconReceipt, IconTrendingUp, IconClock } from "../../components/icons";
import "./NotificationPage.css";

// 알림 종류별 아이콘. 새 종류(친구 초대 등)는 여기에 한 줄 추가하면 된다.
const TYPE_META = {
  WEEKLY_RECAP: { icon: IconTrendingUp, label: "주간 리캡" },
  BUDGET_OVER: { icon: IconClock, label: "예산" },
  FIXED_DUE: { icon: IconReceipt, label: "고정지출" },
};

const timeAgo = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export default function NotificationPage() {
  const { user } = useAuth();
  const userId = user?.userId;
  const navigate = useNavigate();
  const { setUnreadCount } = useNotifications();

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [recapBusy, setRecapBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await notificationApi.list(userId);
      setItems(data.items || []);
      setUnreadCount(data.unreadCount ?? 0);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [userId, setUnreadCount]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (n) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.notiId === n.notiId ? { ...x, read: true } : x)));
      notificationApi.markRead(userId, n.notiId).then(setUnreadCount).catch(() => {});
    }
    if (n.url) navigate(n.url);
  };

  const readAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
    notificationApi.markAllRead(userId).catch(load);
  };

  const remove = async (e, n) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => x.notiId !== n.notiId));
    notificationApi.remove(userId, n.notiId).then(setUnreadCount).catch(load);
  };

  // 정기 발송(월요일 아침)을 기다리지 않고 지난주 리캡을 지금 받아본다 — 푸시도 함께 전송된다.
  const recapNow = async () => {
    if (recapBusy) return;
    setRecapBusy(true);
    try {
      await notificationApi.recapNow(userId);
      await load();
    } catch {
      setStatus("error");
    } finally {
      setRecapBusy(false);
    }
  };

  const hasUnread = items.some((n) => !n.read);

  return (
    <div className="ntf-page">
      <PageHeader
        title="알림"
        subtitle="주간 리캡, 예산·고정지출 알림이 여기에 모여요."
        actions={
          <div className="ntf-actions">
            <button type="button" className="ntf-readall" onClick={recapNow} disabled={recapBusy}>
              {recapBusy ? "만드는 중…" : "리캡 지금 받기"}
            </button>
            <button type="button" className="ntf-readall" onClick={readAll} disabled={!hasUnread}>
              모두 읽음
            </button>
          </div>
        }
      />

      {status === "loading" && <p className="ntf-state">불러오는 중…</p>}
      {status === "error" && (
        <p className="ntf-state">
          알림을 불러오지 못했어요. <button type="button" className="ntf-retry" onClick={load}>다시 시도</button>
        </p>
      )}
      {status === "ready" && items.length === 0 && (
        <div className="ntf-empty">
          <IconBell size={32} />
          <p>아직 받은 알림이 없어요.</p>
          <span>매주 월요일 아침에 지난주 소비 리캡이 도착해요.</span>
        </div>
      )}

      {status === "ready" && items.length > 0 && (
        <ul className="ntf-list">
          {items.map((n) => {
            const meta = TYPE_META[n.type] || { icon: IconBell, label: "알림" };
            const Icon = meta.icon;
            return (
              <li key={n.notiId}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`ntf-item ${n.read ? "" : "is-unread"}`}
                  onClick={() => open(n)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(n)}
                >
                  <span className="ntf-icon"><Icon size={20} /></span>
                  <div className="ntf-body">
                    <div className="ntf-meta">
                      <span className="ntf-label">{meta.label}</span>
                      <span className="ntf-time">{timeAgo(n.createdAt)}</span>
                    </div>
                    <strong className="ntf-title">{n.title}</strong>
                    {n.body && <p className="ntf-text">{n.body}</p>}
                  </div>
                  <button type="button" className="ntf-del" aria-label="알림 삭제" onClick={(e) => remove(e, n)}>
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
