import { useCallback, useEffect, useState } from "react";
import { contractsApi, type MoveOutRequest } from "@/features/contracts/api/contractsApi";
import { Icon, MiniStat, PageHead, Pill } from "@/shared/ui";

type Counts = {
  total: number;
  active: number;
  draft: number;
  pendingMoveOuts: number;
};

const fmtCount = (value: number | undefined) => (value == null ? "—" : String(value));

const fmtDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");

function errText(error: unknown) {
  return error instanceof Error ? error.message : "Không tải được dữ liệu vận hành.";
}

export default function ManagerHome({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pendingMoveOuts, setPendingMoveOuts] = useState<MoveOutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [all, active, draft, moveOuts] = await Promise.all([
        contractsApi.list({ page: 0, size: 1 }),
        contractsApi.list({ status: "ACTIVE", page: 0, size: 1 }),
        contractsApi.list({ status: "DRAFT", page: 0, size: 1 }),
        contractsApi.moveOuts({ status: "PENDING", page: 0, size: 5 }),
      ]);
      setCounts({
        total: all.totalElements,
        active: active.totalElements,
        draft: draft.totalElements,
        pendingMoveOuts: moveOuts.totalElements,
      });
      setPendingMoveOuts(moveOuts.content);
    } catch (loadError) {
      setCounts(null);
      setPendingMoveOuts([]);
      setError(errText(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const errorNote = error ? "Không tải được" : loading ? "Đang tải…" : "Trong phạm vi tòa nhà";

  return (
    <>
      <PageHead
        eyebrow="QUAN_LY · The Fern House"
        title="Chào Quốc Bảo, đây là việc cần duyệt."
        desc="Tổng quan vận hành tòa nhà bạn phụ trách. Dữ liệu chỉ trong phạm vi tòa nhà được phân công."
        actions={
          <>
            <button className="secondary-button" onClick={() => onNavigate("Chốt chỉ số")}>
              <Icon name="wallet" size={16} /> Chốt chỉ số
            </button>
            <button
              className="primary-button"
              disabled
              title="Chưa có API tạo hợp đồng công khai. Cần GET /api/v1/buildings, GET /api/v1/buildings/{buildingId}/rooms (property-service) và API duyệt rental request phát RentalRequestAccepted (listing-booking-service)."
            >
              <Icon name="plus" size={16} /> Tạo hợp đồng
            </button>
          </>
        }
      />

      <div className="alert alert-info mb-6">
        <Icon name="shield" size={18} />
        <div>
          <b>Tạo hợp đồng chưa khả dụng.</b> Contract-tenant-service chỉ có internal{" "}
          <code>POST /internal/contracts/drafts</code> và tạo DRAFT từ event{" "}
          <code>RentalRequestAccepted</code>; chưa có API tạo công khai. Còn thiếu{" "}
          <code>GET /api/v1/buildings</code>, <code>GET /api/v1/buildings/{"{buildingId}"}/rooms</code>{" "}
          (property-service) và API duyệt rental request (listing-booking-service). Không mở internal
          endpoint thành public hoặc dựng form giả.
        </div>
      </div>

      <section className="stats-grid mb-6">
        <MiniStat
          label="Tổng hợp đồng"
          value={fmtCount(counts?.total)}
          note={errorNote}
        />
        <MiniStat
          label="Đang hiệu lực"
          value={fmtCount(counts?.active)}
          note={errorNote}
          tone="sky"
        />
        <MiniStat
          label="Bản nháp"
          value={fmtCount(counts?.draft)}
          note={errorNote}
          tone="amber"
        />
        <MiniStat
          label="Yêu cầu trả phòng"
          value={fmtCount(counts?.pendingMoveOuts)}
          note={error ? "Không tải được" : "Chờ quản lý duyệt"}
          tone="coral"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Yêu cầu trả phòng chờ duyệt</h2>
              <p>Dữ liệu thật từ contract-tenant-service</p>
            </div>
            <Pill tone="coral">
              {loading ? "…" : error ? "Không tải được" : `${counts?.pendingMoveOuts ?? 0} chờ`}
            </Pill>
          </div>
          <div>
            {loading && <div className="p-5 text-sm text-muted">Đang tải yêu cầu trả phòng…</div>}

            {!loading && error && (
              <div className="p-5">
                <div className="alert alert-error">
                  <Icon name="shield" size={18} />
                  <div>{error}</div>
                </div>
                <button className="secondary-button mt-3 !h-9" onClick={() => void load()}>
                  Thử lại
                </button>
              </div>
            )}

            {!loading && !error && pendingMoveOuts.length === 0 && (
              <div className="p-5 text-sm text-muted">
                Không có yêu cầu trả phòng nào đang chờ duyệt.
              </div>
            )}

            {!loading &&
              !error &&
              pendingMoveOuts.map((request) => (
                <div key={request.id} className="approval">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Pill tone="amber">Trả phòng</Pill>
                      <span className="text-[11px] text-muted">HĐ #{request.contractId}</span>
                    </div>
                    <div className="mt-2 text-[14px] font-extrabold">
                      Khách #{request.requestedBy}
                    </div>
                    <div className="text-xs text-muted">
                      Dự kiến trả {fmtDate(request.expectedMoveOutDate)} ·{" "}
                      {request.reason?.trim() || "Không ghi lý do"}
                    </div>
                  </div>
                  <button
                    className="secondary-button !h-9"
                    onClick={() => onNavigate("Hợp đồng")}
                  >
                    Mở hợp đồng
                  </button>
                </div>
              ))}
          </div>
          {!loading && !error && (
            <div className="px-5 pb-5 text-xs text-muted">
              Duyệt/từ chối trong trang Hợp đồng để có xác nhận và kiểm tra ngày trả phòng.
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Yêu cầu thuê &amp; ở ghép</h2>
              <p>Chưa có service backend để tải dữ liệu thật</p>
            </div>
            <Pill tone="slate">Chưa kết nối</Pill>
          </div>
          <div className="p-5 text-sm leading-7 text-muted">
            <p>
              Property service và listing-booking-service chưa có trong workspace, nên màn hình này
              không hiển thị yêu cầu thuê, lịch xem phòng hay hồ sơ ở ghép.
            </p>
            <p className="mt-3 font-bold text-[#0e1a1f]">API tối thiểu cần bổ sung:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              <li>
                <code>GET /api/v1/buildings</code> và{" "}
                <code>GET /api/v1/buildings/{"{buildingId}"}/rooms</code> (scoped theo phân công).
              </li>
              <li>API duyệt yêu cầu thuê phát event <code>RentalRequestAccepted</code>.</li>
              <li>
                <code>GET /api/v1/roommate-posts</code>,{" "}
                <code>POST /api/v1/roommate-applications</code> và API duyệt hồ sơ ở ghép.
              </li>
            </ul>
            <p className="mt-3 text-xs">
              Không dùng dữ liệu giả hoặc nút duyệt cục bộ cho tới khi các API trên hoạt động.
            </p>
          </div>
        </article>
      </div>
    </>
  );
}
