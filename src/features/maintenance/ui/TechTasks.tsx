import { useCallback, useEffect, useState } from "react";
import { Field, Icon, PageHead, Pill, Tabs, toVNTime, useToast, type Tone } from "@/shared/ui";
import { assetApi, type MaintenanceRequest } from "@/api/assetMaintenance";
import { fetchPagedHistory } from "@/api/pagedHistory";

const prioTone: Record<string, Tone> = {
  URGENT: "coral",
  HIGH: "coral",
  MEDIUM: "amber",
  LOW: "slate",
};

const prioLabel: Record<string, string> = {
  URGENT: "Khẩn cấp",
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
};

const statusTone: Record<string, Tone> = {
  ASSIGNED: "amber",
  IN_PROGRESS: "sky",
  COMPLETED: "teal",
};

const statusLabel: Record<string, string> = {
  ASSIGNED: "Mới giao",
  IN_PROGRESS: "Đang xử lý",
  COMPLETED: "Hoàn tất",
};

export default function TechTasks() {
  const [tab, setTab] = useState("Cần làm");
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);

  const [selectedTask, setSelectedTask] = useState<MaintenanceRequest | null>(null);

  // Complete task form
  const [actionTaken, setActionTaken] = useState("");
  const [cost, setCost] = useState("0");
  const [processing, setProcessing] = useState(false);

  const [toast, show] = useToast();

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPartial(false);
    try {
      const history = await fetchPagedHistory(
        (page, size) => assetApi.requestsPage(`?page=${page}&size=${size}`),
      );
      const data = history.items;
      setTasks(data);
      setPartial(!history.complete);
      if (data.length > 0) {
        setSelectedTask((prev) => {
          if (!prev) return data[0];
          return data.find((t) => t.id === prev.id) || data[0];
        });
      } else {
        setSelectedTask(null);
      }
    } catch {
      setError("Không thể tải danh sách phiếu bảo trì được phân công.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleStart = async (id: number) => {
    setProcessing(true);
    try {
      await assetApi.start(id);
      show("Đã bắt đầu xử lý phiếu bảo trì.");
      await loadTasks();
    } catch (e) {
      show(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async (id: number) => {
    if (!actionTaken.trim()) {
      show("Vui lòng ghi rõ biện pháp xử lý đã thực hiện.");
      return;
    }
    setProcessing(true);
    try {
      await assetApi.complete(id, {
        actionTaken: actionTaken.trim(),
        cost: Number(cost) || 0,
      });
      show("Đã hoàn tất nghiệm thu phiếu bảo trì.");
      setActionTaken("");
      setCost("0");
      await loadTasks();
    } catch (e) {
      show(e instanceof Error ? e.message : "Hoàn tất thất bại.");
    } finally {
      setProcessing(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (tab === "Cần làm") return t.status === "ASSIGNED" || t.status === "IN_PROGRESS";
    return t.status === "COMPLETED";
  });

  return (
    <>
      <PageHead
        eyebrow="KY_THUAT · Phân công công việc"
        title="Việc của tôi"
        desc="Danh sách phiếu bảo trì được giao cho tài khoản kỹ thuật. Cập nhật tiến độ xử lý và nghiệm thu."
        actions={
          <div className="flex items-center gap-2">
            <Tabs items={["Cần làm", "Đã xong"]} value={tab} onChange={setTab} />
            <button className="secondary-button" onClick={() => void loadTasks()}>
              <Icon name="refresh" size={16} /> Làm mới
            </button>
          </div>
        }
      />

      {partial && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Chỉ tải được một phần danh sách công việc.</div>}
      {loading ? (
        <div className="p-12 text-center text-sm text-muted">Đang tải danh sách công việc…</div>
      ) : error ? (
        <div className="p-12 text-center">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button className="secondary-button" onClick={() => void loadTasks()}>
            Thử lại
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted">
          {tab === "Cần làm"
            ? "Hiện tại không có phiếu bảo trì nào cần bạn xử lý."
            : "Chưa có phiếu bảo trì nào hoàn tất."}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
          <div className="space-y-3">
            {filteredTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className={`ticket w-full text-left ${selectedTask?.id === t.id ? "ticket-on" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-muted">PHIẾU #{t.id}</span>
                  <div className="flex gap-1.5">
                    <Pill tone={statusTone[t.status] || "slate"}>
                      {statusLabel[t.status] || t.status}
                    </Pill>
                    <Pill tone={prioTone[t.priority] || "slate"}>
                      {prioLabel[t.priority] || t.priority}
                    </Pill>
                  </div>
                </div>
                <h3>Phiếu xử lý phòng #{t.roomId}</h3>
                <div className="flex items-center justify-between text-xs text-muted mt-2">
                  <span className="flex items-center gap-1">
                    <Icon name="pin" size={12} />
                    Tòa #{t.buildingId} · Phòng #{t.roomId}
                  </span>
                  <span>{toVNTime(t.createdAt, true)}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedTask && (
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>Phiếu bảo trì #{selectedTask.id}</h2>
                  <p>
                    Tòa #{selectedTask.buildingId} · Phòng #{selectedTask.roomId}
                    {selectedTask.applianceId ? ` · Thiết bị #${selectedTask.applianceId}` : ""}
                  </p>
                </div>
                <Pill tone={statusTone[selectedTask.status] || "slate"}>
                  {statusLabel[selectedTask.status] || selectedTask.status}
                </Pill>
              </div>

              <div className="space-y-5 p-5">
                <dl className="detail-grid">
                  <div>
                    <dt>Mã báo hỏng gốc</dt>
                    <dd className="!text-[13px] font-mono">#{selectedTask.reportId}</dd>
                  </div>
                  <div>
                    <dt>Độ ưu tiên</dt>
                    <dd className="!text-[13px] font-semibold text-ink">
                      {prioLabel[selectedTask.priority] || selectedTask.priority}
                    </dd>
                  </div>
                  <div>
                    <dt>Hẹn kiểm tra</dt>
                    <dd className="!text-[13px]">
                      {selectedTask.scheduledAt ? toVNTime(selectedTask.scheduledAt, true) : "Chưa hẹn"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tiếp nhận lúc</dt>
                    <dd className="!text-[13px]">{toVNTime(selectedTask.createdAt, true)}</dd>
                  </div>
                </dl>

                {selectedTask.status === "ASSIGNED" && (
                  <div className="rounded-xl border border-line bg-[#f8faf8] p-4">
                    <p className="text-sm text-muted mb-3">
                      Phiếu đã được phân công cho bạn. Nhấn nút bên dưới để xác nhận bắt đầu xử lý.
                    </p>
                    <button
                      className="primary-button w-full"
                      disabled={processing}
                      onClick={() => void handleStart(selectedTask.id)}
                    >
                      {processing ? "Đang cập nhật…" : "Bắt đầu xử lý"}
                    </button>
                  </div>
                )}

                {selectedTask.status === "IN_PROGRESS" && (
                  <div className="space-y-4 rounded-xl border border-line p-4">
                    <h3 className="text-sm font-bold">Nghiệm thu & Hoàn tất sửa chữa</h3>
                    <Field label="Biện pháp xử lý đã thực hiện" hint="Mô tả linh kiện thay thế hoặc cách khắc phục">
                      <textarea
                        className="textarea"
                        rows={3}
                        value={actionTaken}
                        onChange={(e) => setActionTaken(e.target.value)}
                        placeholder="Ví dụ: Đã vệ sinh dàn lạnh và nạp thêm gas..."
                      />
                    </Field>
                    <Field label="Chi phí phát sinh (VNĐ)">
                      <input
                        type="number"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        placeholder="0"
                      />
                    </Field>
                    <button
                      className="primary-button w-full"
                      disabled={processing || !actionTaken.trim()}
                      onClick={() => void handleComplete(selectedTask.id)}
                    >
                      {processing ? "Đang xử lý…" : "Hoàn tất phiếu bảo trì"}
                    </button>
                  </div>
                )}

                {selectedTask.status === "COMPLETED" && (
                  <div className="rounded-xl bg-[#eef8f4] p-4 text-sm text-[#006948]">
                    <div className="font-bold">Phiếu bảo trì đã hoàn tất</div>
                    <div className="mt-1 text-xs">Công việc đã được nghiệm thu và lưu trữ vào lịch sử phòng.</div>
                  </div>
                )}
              </div>
            </article>
          )}
        </div>
      )}

      {toast}
    </>
  );
}
