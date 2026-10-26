import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { todayVN, vnd, useToast } from "@/shared/ui";
import { ApiError } from "@/shared/api/httpClient";
import { useAuth } from "@/features/auth";
import { contractsApi, type Contract, type ContractDetail, type MoveOutRequest } from "@/features/contracts/api/contractsApi";

const ease = [0.22, 1, 0.36, 1] as const;
const reasons = ["Chuyển nơi làm việc", "Tìm phòng khác phù hợp hơn", "Về quê", "Lý do cá nhân", "Khác"];

const statusLabel: Record<Contract["status"], string> = {
  DRAFT: "Nháp",
  ACTIVE: "Đang hiệu lực",
  TERMINATED: "Đã chấm dứt",
  ENDED: "Đã kết thúc",
};
const statusClass: Record<Contract["status"], string> = {
  DRAFT: "mute",
  ACTIVE: "ok",
  TERMINATED: "bad",
  ENDED: "mute",
};
const moveOutLabel: Record<MoveOutRequest["status"], string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
  COMPLETED: "Đã hoàn tất",
};
const moveOutClass: Record<MoveOutRequest["status"], string> = {
  PENDING: "info",
  APPROVED: "ok",
  REJECTED: "bad",
  COMPLETED: "mute",
};

/** YYYY-MM-DD -> DD/MM/YYYY */
const fmtDate = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const fmtMoney = (n: number | null) => (n == null ? "—" : vnd(n));
const errText = (e: unknown) =>
  e instanceof ApiError ? `Không gửi được: ${e.code} · ${e.message}` : e instanceof Error ? `Không gửi được: ${e.message}` : "Không gửi được yêu cầu.";
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export function HomeExtras() {
  const { user } = useAuth();

  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  /** Số thứ tự request chi tiết: response cũ về muộn (đổi hợp đồng / thử lại) bị bỏ qua. */
  const detailReq = useRef(0);

  const [moveOuts, setMoveOuts] = useState<MoveOutRequest[] | null>(null);
  const [moveOutsError, setMoveOutsError] = useState<string | null>(null);

  const [date, setDate] = useState(todayVN);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [reloadWarning, setReloadWarning] = useState("");
  const [toast, show] = useToast();

  const loadContracts = useCallback(async () => {
    setContractsError(null);
    try {
      const list = await contractsApi.mine();
      setContracts(list);
      setSelectedId((current) => (list.some((c) => c.id === current) ? current : (list.find((c) => c.status === "ACTIVE") ?? list[0])?.id ?? null));
    } catch (e) {
      setContracts([]);
      setContractsError(e instanceof ApiError ? `${e.code} · ${e.message}` : e instanceof Error ? e.message : "Lỗi không xác định");
    }
  }, []);

  const loadMoveOuts = useCallback(async () => {
    setMoveOutsError(null);
    try {
      setMoveOuts(await contractsApi.moveOutsMine());
      return true;
    } catch (e) {
      setMoveOuts(null);
      setMoveOutsError(e instanceof ApiError ? `${e.code} · ${e.message}` : e instanceof Error ? e.message : "Lỗi không xác định");
      return false;
    }
  }, []);

  useEffect(() => {
    void loadContracts();
    void loadMoveOuts();
  }, [loadContracts, loadMoveOuts]);

  const loadDetail = useCallback(async (id: number) => {
    const req = ++detailReq.current;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const d = await contractsApi.detail(id);
      if (detailReq.current !== req) return; // đã đổi hợp đồng hoặc bấm thử lại trong lúc chờ
      setDetail(d);
    } catch (e) {
      if (detailReq.current !== req) return;
      setDetailError(e instanceof ApiError ? `${e.code} · ${e.message}` : e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      if (detailReq.current === req) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      detailReq.current += 1; // vô hiệu hoá request đang chạy của hợp đồng trước
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    setConfirming(false);
    setFormError("");
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const selected = useMemo(() => contracts?.find((c) => c.id === selectedId) ?? null, [contracts, selectedId]);
  const pending = useMemo(() => moveOuts?.find((r) => r.contractId === selectedId && r.status === "PENDING") ?? null, [moveOuts, selectedId]);
  const history = useMemo(() => (moveOuts ?? []).filter((r) => r.contractId === selectedId && r.status !== "PENDING"), [moveOuts, selectedId]);

  // Giới hạn ngày theo backend: >= hôm nay (giờ VN) và nằm trong thời hạn hợp đồng.
  const minDate = selected && selected.startDate > todayVN() ? selected.startDate : todayVN();
  const maxDate = selected?.endDate ?? undefined;
  const dateErr = !date
    ? "Chọn ngày muốn trả phòng."
    : date < minDate
      ? `Ngày trả phòng không được trước ${fmtDate(minDate)}.`
      : maxDate && date > maxDate
        ? `Ngày trả phòng không được sau ${fmtDate(maxDate)}.`
        : "";

  // Chỉ người đại diện còn ở mới gửi được (backend tự lấy người gửi từ phiên, không nhận customerId).
  const myTenant = useMemo(
    () => (user ? (detail?.tenants.find((t) => t.customerId === user.id) ?? null) : null),
    [detail, user],
  );
  /** Quyền gửi: chỉ khi đã có ID, detail tải xong và tenant hiện tại là đại diện chưa rời. Không đoán khi thiếu dữ liệu. */
  const isRepresentative = myTenant != null && myTenant.leftAt == null && myTenant.isRepresentative === true;
  const permissionReady = !!user && detail != null && detailError == null;
  const canRequest = !!selected && selected.status === "ACTIVE" && !pending && permissionReady && isRepresentative;

  async function submit() {
    if (!selected || !canRequest) return;
    if (dateErr) {
      setFormError(dateErr);
      return;
    }
    const reasonText = [reason, note.trim()].filter(Boolean).join(" · ");
    setBusy(true);
    setFormError("");
    setReloadWarning("");
    try {
      await contractsApi.createMoveOut({ contractId: selected.id, expectedMoveOutDate: date, ...(reasonText ? { reason: reasonText } : {}) });
    } catch (e) {
      setFormError(errText(e));
      setBusy(false);
      return;
    }
    // POST đã thành công — chỉ báo thành công từ đây.
    setBusy(false);
    setConfirming(false);
    setReason("");
    setNote("");
    show("Đã gửi yêu cầu trả phòng");
    const reloaded = await loadMoveOuts();
    if (!reloaded) setReloadWarning("Yêu cầu đã được gửi, nhưng chưa tải lại được danh sách. Vui lòng tải lại trang để xem trạng thái.");
  }

  const progress = (() => {
    if (!selected?.endDate) return null;
    const total = daysBetween(selected.startDate, selected.endDate);
    if (total <= 0) return 100;
    const used = daysBetween(selected.startDate, todayVN());
    return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
  })();
  const remaining = selected?.endDate ? daysBetween(todayVN(), selected.endDate) : null;

  return (
    <div className="cx-two mt-6">
      <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease }}>
        <h3 className="cx-panel-title">Lịch sử hóa đơn của bạn</h3>
        <div className="alert alert-info">
          Dữ liệu hóa đơn chưa được kết nối. Lịch sử hóa đơn, số tiền và trạng thái thanh toán sẽ hiển thị khi dịch vụ hóa đơn sẵn sàng.
        </div>
      </motion.article>

      <div className="cx-stack">
        <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25, ease }}>
          {contracts === null ? (
            <>
              <h3 className="cx-panel-title">Hợp đồng</h3>
              <p className="cx-meta m-0">Đang tải hợp đồng…</p>
            </>
          ) : contractsError ? (
            <>
              <h3 className="cx-panel-title">Hợp đồng</h3>
              <div className="alert alert-error">Không tải được hợp đồng. <code>{contractsError}</code></div>
              <button className="cx-btn ghost !h-10 w-full" onClick={() => void loadContracts()}>Thử lại</button>
            </>
          ) : !selected ? (
            <>
              <h3 className="cx-panel-title">Hợp đồng</h3>
              <p className="cx-meta m-0">Bạn chưa có hợp đồng nào đang là người ở.</p>
            </>
          ) : (
            <>
              <h3 className="cx-panel-title">Hợp đồng #{selected.id}</h3>
              {contracts && contracts.length > 1 && (
                <label className="cx-field mb-4">
                  Hợp đồng ({contracts.length})
                  <select className="cx-input" value={selected.id} onChange={(e) => setSelectedId(Number(e.target.value))}>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.id} · Phòng #{c.roomId} · {statusLabel[c.status]} · {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="cx-meta">Phòng #{selected.roomId} · Tòa #{selected.buildingId}</span>
                <span className={`cx-status ${statusClass[selected.status]}`}>{statusLabel[selected.status]}</span>
              </div>
              <div className="cx-contract-bar mt-3"><motion.div initial={{ width: 0 }} animate={{ width: `${progress ?? 100}%` }} transition={{ duration: 1.2, delay: 0.3 }} /></div>
              <div className="mt-2 flex justify-between text-xs text-[#6b777d]">
                <span>{fmtDate(selected.startDate)}</span>
                <span>{remaining == null ? "không thời hạn" : remaining < 0 ? "đã hết hạn" : `còn ${remaining} ngày`}</span>
                <span>{fmtDate(selected.endDate)}</span>
              </div>
              <dl className="cx-specs !mt-6">
                <div><dt>Giá thuê</dt><dd>{fmtMoney(selected.rentAmount)}</dd></div>
                <div><dt>Tiền cọc</dt><dd>{fmtMoney(selected.depositAmount)}</dd></div>
              </dl>
              {selected.terminationReason && <p className="cx-meta m-0">Lý do chấm dứt: {selected.terminationReason}</p>}
              <h4 className="cx-panel-title !mt-6">Người ở</h4>
              {detailLoading ? (
                <p className="cx-meta m-0">Đang tải người ở…</p>
              ) : detailError ? (
                <div>
                  <p className="cx-meta m-0">Không tải được danh sách người ở. <code>{detailError}</code></p>
                  <button className="cx-btn ghost !h-10 mt-3 w-full" onClick={() => void loadDetail(selected.id)}>Thử lại</button>
                </div>
              ) : detail === null ? (
                <p className="cx-meta m-0">Chưa tải được danh sách người ở.</p>
              ) : detail.tenants.length === 0 ? (
                <p className="cx-meta m-0">Chưa có người ở trong hợp đồng này.</p>
              ) : (
                detail.tenants.map((t) => (
                  <div key={t.id} className="cx-person">
                    <span className="cx-av">#{String(t.customerId).slice(-2)}</span>
                    <span className="flex-1">
                      Khách #{t.customerId}
                      <small className="block text-[#6b777d]">từ {fmtDate(t.joinedAt)}{t.leftAt ? ` · đã rời ${fmtDate(t.leftAt)}` : ""}</small>
                    </span>
                    {t.isRepresentative && <span className="cx-status ok">Đại diện phòng</span>}
                    {t.leftAt && !t.isRepresentative && <span className="cx-status mute">Đã rời</span>}
                  </div>
                ))
              )}
            </>
          )}
        </motion.article>

        <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3, ease }}>
          <h3 className="cx-panel-title">Yêu cầu trả phòng</h3>
          {!selected ? (
            <p className="cx-meta m-0">Cần có hợp đồng đang hiệu lực để gửi yêu cầu trả phòng.</p>
          ) : selected.status !== "ACTIVE" ? (
            <p className="cx-meta m-0">Hợp đồng #{selected.id} không ở trạng thái đang hiệu lực nên không gửi được yêu cầu trả phòng.</p>
          ) : detailLoading ? (
            <p className="cx-meta m-0">Đang kiểm tra quyền gửi yêu cầu…</p>
          ) : !user ? (
            <p className="cx-meta m-0">Chưa xác định được tài khoản đăng nhập nên tạm khóa gửi yêu cầu trả phòng.</p>
          ) : detail == null ? (
            <p className="cx-meta m-0">Chưa tải được thông tin người ở của hợp đồng nên tạm khóa gửi yêu cầu trả phòng.</p>
          ) : !isRepresentative ? (
            <p className="cx-meta m-0">Chỉ người đại diện mới được gửi yêu cầu trả phòng.</p>
          ) : moveOuts === null && !moveOutsError ? (
            <p className="cx-meta m-0">Đang tải yêu cầu…</p>
          ) : pending ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between gap-3">
                <b>Trả phòng ngày {fmtDate(pending.expectedMoveOutDate)}</b>
                <span className={`cx-status ${moveOutClass.PENDING}`}>{moveOutLabel.PENDING}</span>
              </div>
              <p className="text-sm text-[#56636a]">
                Hợp đồng #{pending.contractId} · gửi ngày {fmtDate(pending.requestDate)}
                {pending.reason ? ` · ${pending.reason}` : ""}. Yêu cầu đang chờ quản lý duyệt.
              </p>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {moveOutsError && (
                <div className="alert alert-error mb-4">
                  Không tải được yêu cầu trước đó. <code>{moveOutsError}</code>
                  <button className="text-button ml-2" onClick={() => void loadMoveOuts()}>Thử lại</button>
                </div>
              )}
              <div className="cx-form">
                <label className="cx-field">
                  Ngày muốn trả
                  <input
                    type="date"
                    className={`cx-input ${dateErr ? "bad" : ""}`}
                    min={minDate}
                    max={maxDate}
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setConfirming(false); setFormError(""); }}
                  />
                </label>
                <label className="cx-field">
                  Lý do (không bắt buộc)
                  <select className="cx-input" value={reason} onChange={(e) => { setReason(e.target.value); setConfirming(false); }}>
                    <option value="">— Không chọn —</option>
                    {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="cx-field full">
                  Ghi chú
                  <textarea className="cx-textarea !m-0" rows={2} value={note} onChange={(e) => { setNote(e.target.value); setConfirming(false); }} placeholder="Thông tin thêm cho quản lý (không bắt buộc)" />
                </label>
              </div>
              {dateErr && <p className="cx-err mt-2">{dateErr}</p>}
              {formError && <p className="cx-err mt-2">{formError}</p>}
              {reloadWarning && <div className="alert alert-info mt-3">{reloadWarning}</div>}
              {confirming ? (
                <div className="cx-confirm">
                  <p className="m-0 mb-3">Xác nhận gửi yêu cầu trả phòng hợp đồng #{selected.id} vào ngày <b>{fmtDate(date)}</b>?</p>
                  <div className="flex gap-2">
                    <button className="cx-btn !h-10 flex-1" disabled={busy || !!dateErr || !canRequest} onClick={() => void submit()}>{busy ? "Đang gửi…" : "Gửi yêu cầu"}</button>
                    <button className="cx-btn ghost !h-10 flex-1" disabled={busy} onClick={() => setConfirming(false)}>Quay lại</button>
                  </div>
                </div>
              ) : (
                <button className="cx-btn mt-4 w-full" disabled={!date || !!dateErr || moveOuts === null || !canRequest} onClick={() => { setFormError(""); setConfirming(true); }}>Tiếp tục</button>
              )}
            </motion.div>
          )}

          {history.length > 0 && (
            <div className="mt-5 border-t border-[#e6eeea] pt-4">
              <h4 className="cx-panel-title">Yêu cầu trước đây</h4>
              {history.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                  <span className="text-[#56636a]">Trả phòng {fmtDate(r.expectedMoveOutDate)}{r.reason ? ` · ${r.reason}` : ""}</span>
                  <span className={`cx-status ${moveOutClass[r.status]}`}>{moveOutLabel[r.status]}</span>
                </div>
              ))}
            </div>
          )}
        </motion.article>
      </div>
      {toast}
    </div>
  );
}

export default HomeExtras;
