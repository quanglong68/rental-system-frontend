import { useCallback, useEffect, useState } from "react";
import { Icon, PageHead, Pill, Tabs, Toolbar, toVNTime, vnd } from "@/shared/ui";
import { contractsApi } from "@/features/contracts/api/contractsApi";
import { bookingApi, type RoommatePost } from "@/api/booking";
import { getMyProfile } from "@/api/userNotification";
import { propertyApi } from "@/features/properties/api/propertyApi";
import { hasAnyRole, useAuth } from "@/features/auth";
import { errorText } from "@/shared/api/errors";
import { idStr, type Id } from "@/shared/lib/id";
import { useBuildingLookup, useCustomerLookup, useRoomLookup } from "@/shared/lib/refLabels";

const errText = (e: unknown) => errorText(e);
const initialsOf = (name?: string) =>
  name?.trim()
    ? name.trim().split(/\s+/).slice(-2).map((word) => word[0]?.toUpperCase() ?? "").join("")
    : null;

const roommateStatus: Record<RoommatePost["status"], { label: string; tone: "teal" | "slate" }> = {
  OPEN: { label: "Đang tìm", tone: "teal" },
  CLOSED: { label: "Đã đóng", tone: "slate" },
};

type ResidentItem = {
  tenantId: Id;
  contractId: Id;
  customerId: Id;
  joinedAt: string;
  leftAt: string | null;
  isRepresentative: boolean;
  roomId: Id;
  buildingId: Id;
  startDate: string;
  endDate: string | null;
  rentAmount: number | null;
};

function RoommateBoard() {
  const { user } = useAuth();
  const isAdmin = hasAnyRole(user, ["ADMIN"]);
  const [buildings, setBuildings] = useState<Id[] | null>(null);
  const [buildingsError, setBuildingsError] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState("");
  const [posts, setPosts] = useState<RoommatePost[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const roomOf = useRoomLookup((posts ?? []).map((p) => p.roomId));
  const buildingOf = useBuildingLookup([...(posts ?? []).map((p) => p.buildingId), ...(buildings ?? [])]);
  const customerOf = useCustomerLookup((posts ?? []).map((p) => p.customerId));

  const loadBuildings = useCallback(async () => {
    setBuildingsError(null);
    try {
      let list: Id[];
      if (isAdmin) {
        const page = await propertyApi.buildings(0, 100, "", "", "");
        list = page.content.map((b) => b.buildingId);
      } else {
        const profile = await getMyProfile();
        list = profile.buildingIds ?? [];
      }
      setBuildings(list);
      if (!isAdmin) setBuildingId(list.length > 0 ? idStr(list[0]) : "");
    } catch (e) {
      setBuildings([]);
      setBuildingId("");
      setBuildingsError(errText(e));
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadBuildings();
  }, [loadBuildings]);

  const loadPosts = useCallback(async () => {
    if (!isAdmin && !buildingId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setPostsError(null);
    try {
      const res = await bookingApi.roommatePosts({
        buildingId: buildingId || undefined,
        page: 0,
        size: 50,
      });
      setPosts(res.content ?? []);
    } catch (e) {
      setPosts([]);
      setPostsError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [buildingId, isAdmin]);

  useEffect(() => {
    if (buildings === null) return;
    void loadPosts();
  }, [buildings, loadPosts]);

  if (buildingsError) {
    return (
      <div className="p-10 text-center">
        <p className="mb-2 text-sm text-red-600">Không tải được phạm vi tòa nhà: {buildingsError}</p>
        <button className="secondary-button" onClick={() => void loadBuildings()}>Thử lại</button>
      </div>
    );
  }

  if (buildings === null) {
    return <div className="p-10 text-center text-sm text-muted">Đang tải phạm vi tòa nhà…</div>;
  }

  if (!isAdmin && buildings.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-muted">
        Tài khoản của bạn chưa được phân công tòa nhà nào nên chưa xem được bài đăng ở ghép.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Icon name="users" size={15} />
          Bài đăng tìm người ở ghép do khách thuê tạo, lọc theo tòa nhà.
        </div>
        <select
          className="select !h-9 !w-auto text-xs"
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
        >
          {isAdmin && <option value="">Tất cả tòa nhà</option>}
          {buildings.map((id) => (
            <option key={idStr(id)} value={idStr(id)}>
              {buildingOf(id) ?? `Tòa nhà #${id}`}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-muted">Đang tải bài đăng ở ghép…</div>
      ) : postsError ? (
        <div className="p-10 text-center">
          <p className="mb-2 text-sm text-red-600">Không tải được bài đăng ở ghép: {postsError}</p>
          <button className="secondary-button" onClick={() => void loadPosts()}>Thử lại</button>
        </div>
      ) : !posts || posts.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted">
          Chưa có bài đăng tìm người ở ghép nào trong phạm vi đang chọn.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bài đăng</th>
                <th>Vị trí</th>
                <th className="text-right">Ngân sách chia sẻ</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const status = roommateStatus[post.status];
                return (
                  <tr key={idStr(post.id)}>
                    <td>
                      <b>{post.title}</b>
                      <div className="sub max-w-[320px] truncate">{post.description?.trim() || "Không có mô tả"}</div>
                      <div className="sub">{customerOf(post.customerId) ?? "Khách thuê"}</div>
                    </td>
                    <td className="text-[13px]">
                      <b>Phòng {roomOf(post.roomId)?.code ?? `#${post.roomId}`}</b> · {buildingOf(post.buildingId) ?? `Tòa #${post.buildingId}`}
                    </td>
                    <td className="text-right font-bold">{vnd(post.budgetShare)}</td>
                    <td>
                      <Pill tone={status?.tone ?? "slate"}>{status?.label ?? post.status}</Pill>
                    </td>
                    <td className="text-[13px]">{toVNTime(post.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

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

  const roomOf = useRoomLookup(residents.map((r) => r.roomId));
  const buildingOf = useBuildingLookup(residents.map((r) => r.buildingId));
  const customerOf = useCustomerLookup(residents.map((r) => r.customerId));

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
            for (const t of detail.tenants.filter((tenant) => !tenant.leftAt)) {
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
                          <span className="avatar-chip !h-9 !w-9">{initialsOf(customerOf(r.customerId)) ?? String(r.customerId).slice(-2)}</span>
                          <div>
                            <b>{customerOf(r.customerId) ?? "Khách thuê"}</b>
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
                        <b>Phòng {roomOf(r.roomId)?.code ?? `#${r.roomId}`}</b> · {buildingOf(r.buildingId) ?? `Tòa #${r.buildingId}`}
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
                      onClick={() => setPage(page - 1)}
                    >
                      Trang trước
                    </button>
                    <button
                      className="secondary-button !h-8 !px-3 text-xs"
                      disabled={page >= totalPages - 1 || loading}
                      onClick={() => setPage(page + 1)}
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
        <article className="panel">
          <RoommateBoard />
        </article>
      )}
    </>
  );
}
