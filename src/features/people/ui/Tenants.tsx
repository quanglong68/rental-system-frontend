import { useCallback, useEffect, useState } from "react";
import { Icon, PageHead, Pill, Tabs, Toolbar, toVNTime, vnd } from "@/shared/ui";
import { contractsApi } from "@/features/contracts/api/contractsApi";

type ResidentItem = {
  tenantId: number;
  contractId: number;
  customerId: number;
  joinedAt: string;
  leftAt: string | null;
  isRepresentative: boolean;
  roomId: number;
  buildingId: number;
  startDate: string;
  endDate: string | null;
  rentAmount: number | null;
};

export default function Tenants() {
  const [tab, setTab] = useState("Khách thuê");
  const [residents, setResidents] = useState<ResidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialError, setPartialError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalContracts, setTotalContracts] = useState(0);

  const loadData = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError(null);
    setPartialError(null);
    try {
      // Chỉ lấy hợp đồng ACTIVE theo đặc tả
      const res = await contractsApi.list({ status: "ACTIVE", page: targetPage, size: 20 });
      setTotalPages(res.totalPages || 1);
      setTotalContracts(res.totalElements || 0);

      if (!res.content || res.content.length === 0) {
        setResidents([]);
        return;
      }

      // Lấy danh sách ContractDetail để bóc tách toàn bộ người ở (kể cả ở ghép)
      const detailPromises = res.content.map((c) => contractsApi.detail(c.id));
      const settled = await Promise.allSettled(detailPromises);

      let failedCount = 0;
      const allResidents: ResidentItem[] = [];

      settled.forEach((result, idx) => {
        const contract = res.content[idx];
        if (result.status === "fulfilled") {
          const detail = result.value;
          if (detail.tenants && detail.tenants.length > 0) {
            for (const t of detail.tenants) {
              allResidents.push({
                tenantId: t.id,
                contractId: contract.id,
                customerId: t.customerId,
                joinedAt: t.joinedAt,
                leftAt: t.leftAt,
                isRepresentative: t.isRepresentative,
                roomId: contract.roomId,
                buildingId: contract.buildingId,
                startDate: contract.startDate,
                endDate: contract.endDate,
                rentAmount: contract.rentAmount,
              });
            }
          } else {
            // Hợp đồng thiếu danh sách tenant: tăng cảnh báo partial, không tự khẳng định khách đang ở
            failedCount++;
          }
        } else {
          // Lỗi gọi chi tiết hợp đồng: tăng cảnh báo partial, không fallback suy đoán
          failedCount++;
        }
      });

      if (failedCount > 0) {
        setPartialError(
          `Cảnh báo: Không thể tải hoặc thiếu dữ liệu người ở của ${failedCount}/${res.content.length} hợp đồng trên trang này.`
        );
      }

      setResidents(allResidents);
    } catch {
      setError("Không thể tải danh sách hợp đồng cư dân từ máy chủ.");
      setResidents([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadData(page);
  }, [loadData, page]);

  const filtered = residents.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      String(r.customerId).includes(q) ||
      String(r.roomId).includes(q) ||
      String(r.buildingId).includes(q) ||
      String(r.contractId).includes(q)
    );
  });

  return (
    <>
      <PageHead
        eyebrow="Cộng đồng cư dân"
        title="Khách thuê & Ở ghép"
        desc="Danh sách người ở theo hợp đồng đang hiệu lực (ACTIVE), bao gồm đại diện hợp đồng và người ở ghép."
        actions={
          <Tabs items={["Khách thuê", "Tìm người ở ghép"]} value={tab} onChange={setTab} />
        }
      />

      {tab === "Khách thuê" ? (
        <article className="panel">
          <Toolbar
            placeholder="Tìm theo ID khách, phòng, tòa, HĐ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {partialError && (
            <div className="mx-4 my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {partialError}
            </div>
          )}

          {loading ? (
            <div className="p-10 text-center text-sm text-muted">Đang tải dữ liệu người ở từ các hợp đồng ACTIVE…</div>
          ) : error ? (
            <div className="p-10 text-center">
              <p className="text-sm text-red-600 mb-2">{error}</p>
              <button className="secondary-button" onClick={() => void loadData(page)}>
                Thử lại
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted">
              Không có cư dân nào trong các hợp đồng đang hiệu lực phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Người ở (Cư dân)</th>
                    <th>Vai trò</th>
                    <th>Vị trí phòng & HĐ</th>
                    <th>Ngày gia nhập</th>
                    <th>Thời hạn HĐ</th>
                    <th className="text-right">Tiền thuê HĐ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={`${r.contractId}-${r.tenantId}-${r.customerId}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="avatar-chip !h-9 !w-9 font-mono">#{r.customerId}</span>
                          <div>
                            <b>Khách #{r.customerId}</b>
                            <div className="sub">Mã cư dân #{r.tenantId}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.isRepresentative ? (
                            <Pill tone="teal">Đại diện</Pill>
                          ) : (
                            <Pill tone="violet">Ở ghép</Pill>
                          )}
                          {r.leftAt && <Pill tone="slate">Đã rời</Pill>}
                        </div>
                      </td>
                      <td className="text-[13px]">
                        <b>Phòng #{r.roomId}</b> · Tòa #{r.buildingId}
                        <div className="sub text-xs text-muted">HĐ #{r.contractId}</div>
                      </td>
                      <td className="text-[13px]">
                        <div>{toVNTime(r.joinedAt)}</div>
                        {r.leftAt && (
                          <small className="text-muted">Rời: {toVNTime(r.leftAt)}</small>
                        )}
                      </td>
                      <td className="text-[13px]">
                        <div>{toVNTime(r.startDate)}</div>
                        <small className="text-muted">
                          đến {r.endDate ? toVNTime(r.endDate) : "Vô thời hạn"}
                        </small>
                      </td>
                      <td className="text-right font-bold">
                        {r.rentAmount != null ? vnd(r.rentAmount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-line px-4 py-3">
                  <span className="text-xs text-muted">
                    Trang {page + 1} / {totalPages} (Tổng số {totalContracts} hợp đồng ACTIVE)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className="secondary-button !h-8 !px-3 text-xs"
                      disabled={page === 0 || loading}
                      onClick={() => {
                        const next = page - 1;
                        setPage(next);
                        void loadData(next);
                      }}
                    >
                      Trang trước
                    </button>
                    <button
                      className="secondary-button !h-8 !px-3 text-xs"
                      disabled={page >= totalPages - 1 || loading}
                      onClick={() => {
                        const next = page + 1;
                        setPage(next);
                        void loadData(next);
                      }}
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </article>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <Icon name="users" size={28} />
          </div>
          <h2 className="text-xl font-bold">Dịch vụ tìm người ở ghép chưa được kết nối</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            Tính năng đăng bài và duyệt hồ sơ ở ghép (thuộc <code>listing-booking-service</code> tại cổng 8084) hiện chưa có service backend hoạt động.
            Hệ thống sẽ cập nhật khi dịch vụ được phát hành.
          </p>
        </div>
      )}
    </>
  );
}
