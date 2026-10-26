import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, toVNTime } from "@/shared/ui";
import { assetApi, type MaintenanceReport, type MaintenanceRequest } from "@/api/assetMaintenance";
import { fetchPagedHistory, type PagedHistory } from "@/api/pagedHistory";
import { contractsApi, type Contract } from "@/features/contracts/api/contractsApi";

const cats = [
  { k: "Điện", e: "⚡" },
  { k: "Nước", e: "💧" },
  { k: "Máy lạnh", e: "❄️" },
  { k: "Internet", e: "📶" },
  { k: "Khóa cửa", e: "🔑" },
  { k: "Khác", e: "✦" },
];
const steps = ["Đã gửi", "Đã tiếp nhận", "Đang xử lý", "Hoàn tất"];
const MAX = 5;
const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 100;

type HistoryState<T> = PagedHistory<T> | null;

function historyWarning(history: HistoryState<unknown>): string | null {
  if (!history || history.complete) return null;
  if (history.incompleteReason === "page-limit") {
    return `Chỉ tải được ${history.loadedPages}/${history.totalPages} trang lịch sử (${history.items.length}/${history.totalElements} mục).`;
  }
  return `Chỉ tải được một phần lịch sử (${history.items.length}/${history.totalElements} mục).`;
}

type PickedFile = {
  file: File;
  previewUrl: string;
  name: string;
};

export default function Repairs() {
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [reportsHistory, setReportsHistory] = useState<HistoryState<MaintenanceReport>>(null);
  const [requestsHistory, setRequestsHistory] = useState<HistoryState<MaintenanceRequest>>(null);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [activeContract, setActiveContract] = useState<Contract | null>(null);
  const [loadingContract, setLoadingContract] = useState(true);
  const [contractError, setContractError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [photoErr, setPhotoErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [cat, setCat] = useState("Điện");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    setReportsError(null);
    try {
      const history = await fetchPagedHistory(assetApi.myReportsPage, {
        pageSize: HISTORY_PAGE_SIZE,
        maxPages: HISTORY_MAX_PAGES,
      });
      setReports(history.items);
      setReportsHistory(history);
    } catch {
      setReportsError("Không thể tải danh sách báo hỏng từ máy chủ.");
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    setRequestsError(null);
    try {
      const history = await fetchPagedHistory(assetApi.myRequestsPage, {
        pageSize: HISTORY_PAGE_SIZE,
        maxPages: HISTORY_MAX_PAGES,
      });
      setRequests(history.items);
      setRequestsHistory(history);
    } catch {
      setRequestsError("Không thể tải phiếu kỹ thuật tương ứng từ máy chủ.");
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    await Promise.allSettled([loadReports(), loadRequests()]);
  }, [loadReports, loadRequests]);

  const loadContracts = useCallback(async () => {
    setLoadingContract(true);
    setContractError(null);
    try {
      const list = await contractsApi.mine();
      const active = list.find((c) => c.status === "ACTIVE") ?? null;
      setActiveContract(active);
    } catch {
      setActiveContract(null);
      setContractError("Không thể tải thông tin hợp đồng thuê phòng.");
    } finally {
      setLoadingContract(false);
    }
  }, []);

  const requestByReportId = useMemo(() => {
    const map = new Map<number, MaintenanceRequest>();
    for (const req of requests) {
      if (req.reportId != null) {
        map.set(req.reportId, req);
      }
    }
    return map;
  }, [requests]);

  useEffect(() => {
    void loadHistory();
    void loadContracts();
  }, [loadHistory, loadContracts]);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [photos]);

  const pick = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = MAX - photos.length;
    if (imgs.length > room) {
      setPhotoErr(`Chỉ được tải tối đa ${MAX} ảnh. Đã bỏ qua ${imgs.length - Math.max(room, 0)} ảnh.`);
    } else {
      setPhotoErr("");
    }
    const added = imgs.slice(0, Math.max(room, 0)).map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      name: f.name,
    }));
    setPhotos([...photos, ...added]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePhoto = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    setPhotos(photos.filter((p) => p.previewUrl !== previewUrl));
    setPhotoErr("");
  };

  const submit = async () => {
    if (!text.trim()) return;
    if (!activeContract) {
      setSubmitError("Bạn cần có hợp đồng thuê phòng đang hiệu lực để gửi báo hỏng.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");
    try {
      const uploadedUrls: string[] = [];
      for (const item of photos) {
        const url = await assetApi.uploadImage(item.file);
        uploadedUrls.push(url);
      }

      await assetApi.createReport({
        roomId: activeContract.roomId,
        title: `[${cat}] ${text.trim().slice(0, 45)}`,
        description: text.trim(),
        imageUrls: uploadedUrls,
      });

      setText("");
      setPhotos([]);
      setSubmitSuccess("Đã gửi báo hỏng thành công. Ban quản lý sẽ tiếp nhận trong thời gian sớm nhất.");
      await loadHistory();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gửi báo hỏng thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Hỗ trợ kỹ thuật · Phản hồi trong 24 giờ</div>
      <h1 className="cx-serif cx-h2">
        Có gì <em>trục trặc</em>? Nói với chúng tôi.
      </h1>
      <div className="cx-repair">
        <div className="cx-panel h-fit">
          <h3 className="cx-panel-title">Loại sự cố</h3>
          <div className="cx-cats">
            {cats.map((c) => (
              <motion.button
                key={c.k}
                type="button"
                whileTap={{ scale: 0.94 }}
                className={cat === c.k ? "on" : ""}
                onClick={() => setCat(c.k)}
              >
                <span className="text-xl">{c.e}</span>
                {c.k}
              </motion.button>
            ))}
          </div>

          {loadingContract ? (
            <div className="alert alert-info mb-3">Đang kiểm tra thông tin hợp đồng thuê phòng…</div>
          ) : contractError ? (
            <div className="alert alert-error mb-3 flex items-center justify-between">
              <span>{contractError}</span>
              <button
                type="button"
                className="secondary-button !py-1 !px-2.5 text-xs"
                onClick={() => void loadContracts()}
              >
                Thử lại
              </button>
            </div>
          ) : !activeContract ? (
            <div className="alert alert-info mb-3">
              Bạn chưa có hợp đồng thuê phòng đang hiệu lực để gửi báo hỏng.
            </div>
          ) : null}

          <textarea
            className="cx-textarea"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mô tả chi tiết sự cố và thời gian có thể hỗ trợ kiểm tra…"
            disabled={!activeContract || submitting}
          />

          <label
            className={`cx-drop ${!activeContract ? "opacity-50 pointer-events-none" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => pick(e.target.files)}
              disabled={!activeContract || submitting}
            />
            <Icon name="plus" size={18} /> Kéo thả hoặc chọn ảnh · {photos.length}/{MAX}
          </label>

          {photoErr && <p className="cx-err -mt-2 mb-3">{photoErr}</p>}
          {submitError && <div className="alert alert-error mb-3">{submitError}</div>}
          {submitSuccess && <div className="alert alert-info mb-3">{submitSuccess}</div>}

          {photos.length > 0 && (
            <div className="cx-thumbs">
              <AnimatePresence>
                {photos.map((p) => (
                  <motion.div
                    key={p.previewUrl}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <img src={p.previewUrl} alt={p.name} />
                    <button
                      type="button"
                      aria-label={`Xóa ảnh ${p.name}`}
                      onClick={() => removePhoto(p.previewUrl)}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <motion.button
            className="cx-btn w-full mt-2"
            whileTap={{ scale: 0.97 }}
            disabled={!text.trim() || !activeContract || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Đang gửi…" : "Gửi yêu cầu"}
          </motion.button>
        </div>

        <div className="space-y-4">
          {requestsError && !loadingRequests && (
            <div className="alert alert-warning flex items-center justify-between gap-3">
              <span>Không thể tải phiếu kỹ thuật tương ứng. Thông tin tiến độ có thể chưa được cập nhật mới nhất.</span>
              <button type="button" className="secondary-button !py-1 !px-2.5 text-xs" onClick={() => void loadRequests()}>
                Thử lại phiếu kỹ thuật
              </button>
            </div>
          )}
          {!requestsError && historyWarning(requestsHistory) && (
            <div className="alert alert-warning flex items-center justify-between gap-3">
              <span>Phiếu kỹ thuật: {historyWarning(requestsHistory)}</span>
              <button type="button" className="secondary-button !py-1 !px-2.5 text-xs" onClick={() => void loadRequests()}>
                Thử lại phiếu kỹ thuật
              </button>
            </div>
          )}
          {loadingReports ? (
            <div className="p-8 text-center text-sm text-muted">Đang tải danh sách báo hỏng…</div>
          ) : reportsError ? (
            <div className="p-8 text-center">
              <p className="text-sm text-red-600 mb-2">{reportsError}</p>
              <button type="button" className="secondary-button" onClick={() => void loadReports()}>
                Thử lại báo hỏng
              </button>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">Bạn chưa gửi báo hỏng nào.</div>
          ) : (
            <>
              {historyWarning(reportsHistory) && (
                <div className="alert alert-warning flex items-center justify-between gap-3">
                  <span>Báo hỏng: {historyWarning(reportsHistory)}</span>
                  <button type="button" className="secondary-button !py-1 !px-2.5 text-xs" onClick={() => void loadReports()}>
                    Thử lại báo hỏng
                  </button>
                </div>
              )}
            <AnimatePresence initial={false}>
              {reports.map((r) => {
                const req = requestByReportId.get(r.id);
                let step = 0;
                let statusLabel = "Chờ duyệt";
                let statusClass = "info";

                if (r.status === "REJECTED") {
                  statusLabel = "Bị từ chối";
                  statusClass = "bad";
                } else if (req) {
                  if (req.status === "COMPLETED") {
                    step = 3;
                    statusLabel = "Hoàn tất";
                    statusClass = "ok";
                  } else if (req.status === "IN_PROGRESS") {
                    step = 2;
                    statusLabel = "Đang xử lý";
                    statusClass = "info";
                  } else {
                    step = 1;
                    statusLabel = "Đã phân công";
                    statusClass = "ok";
                  }
                } else if (r.status === "APPROVED") {
                  step = 1;
                  statusLabel = "Đã tiếp nhận";
                  statusClass = "ok";
                }

                return (
                  <motion.article
                    key={r.id}
                    layout
                    className="cx-panel"
                    initial={{ opacity: 0, y: -20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="cx-meta">
                        Báo hỏng #{r.id} · Phòng #{r.roomId}
                      </span>
                      <span className={`cx-status ${statusClass}`}>{statusLabel}</span>
                    </div>

                    <h3 className="cx-serif mt-3 text-2xl">{r.title}</h3>
                    <p className="text-sm text-[#56636a] mt-1">{r.description}</p>
                    <div className="mt-2 text-xs text-[#6b777d]">
                      Gửi lúc {toVNTime(r.createdAt, true)}
                    </div>

                    {r.status !== "REJECTED" ? (
                      <>
                        <div className="cx-steps">
                          {steps.map((s, i) => (
                            <div key={s} className={i <= step ? "done" : ""}>
                              <motion.i
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: i <= step ? 1 : 0 }}
                                transition={{ duration: 0.5, delay: 0.15 * i }}
                              />
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>

                        {req && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf1f3] pt-3 text-xs text-[#56636a]">
                            <span>
                              Phiếu kỹ thuật: <b>#{req.id}</b>
                            </span>
                            {req.scheduledAt && (
                              <span>
                                Hẹn kiểm tra: <b>{toVNTime(req.scheduledAt, true)}</b>
                              </span>
                            )}
                            {req.staffId && <span>Kỹ thuật viên: #{req.staffId}</span>}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                        <b>Lý do từ chối:</b> {r.rejectReason || "Không có lý do cụ thể"}
                      </div>
                    )}

                    {r.imageUrls && r.imageUrls.length > 0 && (
                      <div className="cx-thumbs !mb-0 mt-4">
                        {r.imageUrls.map((u, idx) => (
                          <div key={idx}>
                            <img src={u} alt={`Ảnh đính kèm ${idx + 1}`} />
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.article>
                );
              })}
            </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
