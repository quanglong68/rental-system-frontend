import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Id } from "@/shared/lib/id";
import { Icon, PageHead, Pill, Tabs, toVNTime, useToast, type Tone } from "@/shared/ui";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationAdminTarget,
  notificationKind,
  type NotificationItem,
} from "@/api/userNotification";

const kindTone: Record<string, Tone> = {
  "Hóa đơn": "teal",
  "Lịch hẹn": "sky",
  "Chỉ số": "teal",
  "Sửa chữa": "amber",
  "Ở ghép": "violet",
  "Hợp đồng": "coral",
  "Yêu cầu thuê": "sky",
  "Hệ thống": "slate",
};

const tabs = ["Tất cả", "Chưa đọc"];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(tabs[0]);
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getNotifications(0, false, 100);
      setItems(res.content ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được thông báo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items.filter((n) => !n.isRead).length;
  const shown = items.filter((n) => tab === "Tất cả" || !n.isRead);

  const notifyUpdated = () => window.dispatchEvent(new Event("notifications:updated"));

  const handleRead = async (id: Id) => {
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      notifyUpdated();
    } catch (e) {
      show(e instanceof Error ? e.message : "Không thể đánh dấu đã đọc.");
    }
  };

  const handleReadAll = async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      notifyUpdated();
      show("Đã đánh dấu tất cả thông báo là đã đọc.");
    } catch (e) {
      show(e instanceof Error ? e.message : "Không thể đánh dấu tất cả đã đọc.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="THÔNG BÁO"
        title="Thông báo"
        desc="Toàn bộ thông báo vận hành của bạn: hóa đơn, lịch hẹn, sửa chữa, hợp đồng và yêu cầu thuê."
        actions={
          <button className="secondary-button" disabled={busy || unread === 0} onClick={() => void handleReadAll()}>
            <Icon name="check" size={16} /> {busy ? "Đang xử lý…" : "Đánh dấu tất cả đã đọc"}
          </button>
        }
      />

      <article className="panel">
        <div className="panel-header">
          <div>
            <h2>Hộp thư thông báo</h2>
            <p>{loading ? "Đang tải…" : `${items.length} thông báo · ${unread} chưa đọc`}</p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs items={tabs} value={tab} onChange={setTab} />
            <button className="text-button" onClick={() => void load()}>
              <Icon name="arrow" size={14} /> Làm mới
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Đang tải thông báo…</div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="mb-2 text-sm text-red-600">{error}</p>
            <button className="secondary-button" onClick={() => void load()}>Thử lại</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {tab === "Chưa đọc" ? "Bạn đã đọc hết thông báo." : "Chưa có thông báo nào."}
          </div>
        ) : (
          <div className="activity-list">
            {shown.map((n) => {
              const kind = notificationKind(n.type);
              const target = notificationAdminTarget(n);
              return (
                <div
                  key={String(n.id)}
                  className={`activity ${target ? "cursor-pointer hover:bg-slate-50/70 transition-colors" : ""} ${n.isRead ? "opacity-60" : ""}`}
                  onClick={target ? async () => {
                    if (!n.isRead) await handleRead(n.id);
                    navigate(target);
                  } : undefined}
                >
                  <div className="activity-avatar bg-sky-100 text-sky-700"><Icon name="bell" size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Pill tone={kindTone[kind] ?? "slate"}>{kind}</Pill>
                          {!n.isRead && <span className="text-[11px] font-bold text-teal">Mới</span>}
                          {target && <span className="text-[11px] font-medium text-teal-700">Bấm để mở →</span>}
                        </div>
                        <div className="mt-1 text-[13px] font-bold leading-5">{n.title}</div>
                        <div className="text-xs text-muted">{n.content}</div>
                        <div className="mt-1 text-[11px] text-muted">{toVNTime(n.createdAt, true)}</div>
                      </div>
                      {!n.isRead ? (
                        <button
                          className="text-button shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRead(n.id);
                          }}
                        >
                          Đánh dấu đã đọc
                        </button>
                      ) : (
                        <span className="shrink-0 text-[11px] text-muted">Đã đọc</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>
      {toast}
    </>
  );
}
