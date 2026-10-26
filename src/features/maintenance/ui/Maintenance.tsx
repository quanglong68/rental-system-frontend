import { useCallback, useEffect, useState } from "react";
import { Drawer, Field, Icon, PageHead, Pill, toVNTime, useToast, type Tone } from "@/shared/ui";
import { hasAnyRole, useAuth } from "@/features/auth";
import { getMyProfile, getStaff, type UserProfile } from "@/api/userNotification";
import { fetchPagedHistory } from "@/api/pagedHistory";
import {
  assetApi,
  type MaintenanceReport,
  type MaintenanceRequest,
} from "@/api/assetMaintenance";

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

export default function Maintenance() {
  const { user } = useAuth();
  const isAdmin = hasAnyRole(user, ["ADMIN"]);
  const isTech = hasAnyRole(user, ["KY_THUAT"]);
  const isSale = hasAnyRole(user, ["SALE"]);
  // SALE được đọc báo hỏng trong building scope; chỉ QUAN_LY/ADMIN được duyệt/từ chối.
  const canReadReports = hasAnyRole(user, ["QUAN_LY", "SALE", "ADMIN"]);
  const canManageReports = hasAnyRole(user, ["QUAN_LY", "ADMIN"]);

  const [availableBuildings, setAvailableBuildings] = useState<number[]>([]);
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [allTechnicians, setAllTechnicians] = useState<UserProfile[]>([]);
  const [staffLoadError, setStaffLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestsPartial, setRequestsPartial] = useState(false);

  const [pendingReports, setPendingReports] = useState<MaintenanceReport[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);

  // Approve drawer state
  const [selectedReport, setSelectedReport] = useState<MaintenanceReport | null>(null);
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignPriority, setAssignPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
  const [assignScheduledAt, setAssignScheduledAt] = useState("");
  const [assignApplianceId, setAssignApplianceId] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [toast, show] = useToast();

  // Tải danh sách tòa nhà theo thẩm quyền và danh sách kỹ thuật viên
  const loadBuildings = useCallback(async () => {
    setLoadingBuildings(true);
    setProfileError(null);
    setStaffLoadError(null);
    try {
      let bList: number[] = [];
      if (isAdmin) {
        // Với ADMIN: chỉ dùng nguồn có thẩm quyền từ property-service.
        // Vì property-service (cổng 8083) chưa có mã nguồn backend, để danh sách rỗng thay vì suy đoán từ nhân sự.
        bList = [];
      } else {
        try {
          const profile = await getMyProfile();
          bList = profile.buildingIds
            ? Array.from(new Set(profile.buildingIds)).sort((a, b) => a - b)
            : [];
        } catch (err) {
          setProfileError(err instanceof Error ? err.message : "Không thể tải hồ sơ cá nhân.");
          bList = [];
        }
      }

      let techs: UserProfile[] = [];
      try {
        if (isAdmin) {
          const staffRes = await getStaff(0, 100);
          techs = (staffRes.content || []).filter((s) => {
            const pos = (s.position || "").toUpperCase();
            return pos.includes("KY_THUAT") || pos.includes("KỸ THUẬT");
          });
        } else if (canManageReports && bList.length > 0) {
          // Lấy kỹ thuật viên cho từng tòa được phân công, gộp theo ID
          const staffMap = new Map<number, UserProfile>();
          await Promise.all(
            bList.map(async (bId) => {
              try {
                const res = await getStaff(0, 100, bId);
                for (const s of res.content || []) {
                  const existing = staffMap.get(s.id);
                  if (existing) {
                    const mergedBIds = Array.from(
                      new Set([...(existing.buildingIds || []), ...(s.buildingIds || [])])
                    );
                    staffMap.set(s.id, { ...existing, buildingIds: mergedBIds });
                  } else {
                    staffMap.set(s.id, s);
                  }
                }
              } catch {
                // Bỏ qua lỗi riêng lẻ của từng tòa
              }
            })
          );
          techs = Array.from(staffMap.values()).filter((s) => {
            const pos = (s.position || "").toUpperCase();
            return pos.includes("KY_THUAT") || pos.includes("KỸ THUẬT");
          });
        }
      } catch (err) {
        setStaffLoadError(err instanceof Error ? err.message : "Không thể tải danh sách nhân sự");
      }

      setAllTechnicians(techs);
      setAvailableBuildings(bList);
      if (bList.length > 0) {
        setBuildingId(bList[0]);
      } else {
        setBuildingId(null);
      }
    } catch (e) {
      if (!isAdmin) {
        setProfileError(e instanceof Error ? e.message : "Lỗi kết nối khi tải hồ sơ phân công.");
      }
      setAvailableBuildings([]);
      setBuildingId(null);
    } finally {
      setLoadingBuildings(false);
    }
  }, [isAdmin, canManageReports]);

  useEffect(() => {
    void loadBuildings();
  }, [loadBuildings]);

  // Lọc kỹ thuật viên theo buildingIds có chứa tòa nhà đang chọn
  const buildingTechs = buildingId != null
    ? allTechnicians.filter((t) => t.buildingIds && t.buildingIds.includes(buildingId))
    : [];

  useEffect(() => {
    if (buildingTechs.length > 0) {
      setAssignStaffId(String(buildingTechs[0].id));
    } else {
      setAssignStaffId("");
    }
  }, [buildingId, allTechnicians]);

  const loadData = useCallback(async () => {
    if (buildingId == null) {
      setPendingReports([]);
      setRequests([]);
      return;
    }
    setLoading(true);
    setReportsError(null);
    setRequestsError(null);
    setRequestsPartial(false);

    const promises: Promise<void>[] = [];

    // QUAN_LY/SALE/ADMIN được đọc /api/v1/reports trong scope; KY_THUAT không gọi endpoint này.
    if (canReadReports) {
      promises.push(
        fetchPagedHistory(
          (page, size) => assetApi.reportsPage(buildingId, "PENDING", page, size),
        )
          .then((history) => setPendingReports(history.items))
          .catch((err) => {
            setReportsError(err instanceof Error ? err.message : "Không thể tải báo hỏng từ máy chủ.");
            setPendingReports([]);
          })
      );
    } else {
      setPendingReports([]);
    }

    promises.push(
      fetchPagedHistory(
        (page, size) => assetApi.requestsPage(`?buildingId=${buildingId}&page=${page}&size=${size}`),
      )
        .then((history) => {
          setRequests(history.items);
          setRequestsPartial(!history.complete);
        })
        .catch((err) => {
          setRequestsError(err instanceof Error ? err.message : "Không thể tải danh sách phiếu bảo trì.");
          setRequests([]);
          setRequestsPartial(false);
        })
    );

    await Promise.allSettled(promises);
    setLoading(false);
  }, [buildingId, canReadReports]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = async () => {
    if (!selectedReport) return;
    if (!canManageReports) {
      show("Chỉ Quản lý hoặc Quản trị viên mới có quyền duyệt báo hỏng.");
      return;
    }
    const staffIdNum = Number(assignStaffId);
    if (!staffIdNum || buildingTechs.length === 0) {
      show("Không có kỹ thuật viên hợp lệ được phân công tại tòa nhà này.");
      return;
    }
    setApproving(true);
    try {
      const date = assignScheduledAt
        ? new Date(assignScheduledAt).toISOString()
        : new Date(Date.now() + 86400000).toISOString();
      await assetApi.approve(selectedReport.id, {
        staffId: staffIdNum,
        priority: assignPriority,
        scheduledAt: date,
        applianceId: assignApplianceId ? Number(assignApplianceId) : undefined,
      });
      show("Đã duyệt báo hỏng và phân công kỹ thuật.");
      setSelectedReport(null);
      await loadData();
    } catch (e) {
      show(e instanceof Error ? e.message : "Duyệt thất bại.");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReport) return;
    if (!canManageReports) {
      show("Chỉ Quản lý hoặc Quản trị viên mới có quyền từ chối báo hỏng.");
      return;
    }
    if (!rejectReason.trim()) {
      show("Vui lòng nhập lý do từ chối.");
      return;
    }
    setRejecting(true);
    try {
      await assetApi.reject(selectedReport.id, rejectReason.trim());
      show("Đã từ chối báo hỏng.");
      setSelectedReport(null);
      setRejectReason("");
      await loadData();
    } catch (e) {
      show(e instanceof Error ? e.message : "Từ chối thất bại.");
    } finally {
      setRejecting(false);
    }
  };

  const assignedRequests = requests.filter((r) => r.status === "ASSIGNED");
  const inProgressRequests = requests.filter((r) => r.status === "IN_PROGRESS");
  const completedRequests = requests.filter((r) => r.status === "COMPLETED");

  return (
    <>
      <PageHead
        eyebrow="Vận hành kỹ thuật"
        title="Bảo trì & Sửa chữa"
        desc={
          isTech
            ? "Danh sách phiếu bảo trì kỹ thuật được phân công theo tòa nhà."
            : isSale
              ? "Xem báo hỏng và phiếu bảo trì trong tòa nhà được phân công. Vai trò SALE chỉ đọc."
              : "Tiếp nhận báo hỏng từ khách thuê và quy trình xử lý theo kỹ thuật viên từng tòa nhà."
        }
        actions={
          <div className="flex items-center gap-2">
            {availableBuildings.length > 0 ? (
              <select
                className="select !h-[42px]"
                value={buildingId ?? ""}
                onChange={(e) => setBuildingId(Number(e.target.value))}
              >
                {availableBuildings.map((id) => (
                  <option key={id} value={id}>
                    Tòa nhà #{id}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs text-muted">
                {loadingBuildings
                  ? "Đang kiểm tra tòa…"
                  : profileError && !isAdmin
                  ? "Lỗi tải hồ sơ"
                  : "Chưa có tòa phân công"}
              </span>
            )}
            <button
              className="secondary-button"
              disabled={loading || buildingId == null}
              onClick={() => void loadData()}
            >
              <Icon name="refresh" size={16} /> Làm mới
            </button>
          </div>
        }
      />

      {loadingBuildings ? (
        <div className="p-12 text-center text-sm text-muted">Đang kiểm tra phân công tòa nhà…</div>
      ) : profileError && !isAdmin ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <Icon name="tools" size={28} />
          </div>
          <h2 className="text-xl font-bold">Không thể tải hồ sơ phân công</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            Lỗi kết nối tới dịch vụ hồ sơ (<code>user-notification-service</code>): {profileError}.
            Hệ thống không thể xác định danh sách tòa nhà bạn phụ trách.
          </p>
          <button className="secondary-button mt-4" onClick={() => void loadBuildings()}>
            <Icon name="refresh" size={16} /> Thử lại
          </button>
        </div>
      ) : availableBuildings.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <Icon name="tools" size={28} />
          </div>
          {isAdmin ? (
            <>
              <h2 className="text-xl font-bold">Dịch vụ quản lý tòa nhà chưa được kết nối</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
                Tài khoản Quản trị viên (ADMIN) cần truy xuất danh mục toàn bộ tòa nhà từ <code>property-service</code> (cổng 8083),
                nhưng dịch vụ này hiện chưa có mã nguồn backend. Hệ thống không tự suy đoán danh sách tòa từ phân công nhân sự.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Chưa có tòa nhà nào được phân công</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
                Tài khoản của bạn chưa có danh sách tòa nhà phụ trách (<code>buildingIds</code>) trong hồ sơ nhân sự (<code>user-notification-service</code>).
                Vui lòng liên hệ quản lý để được phân công tòa nhà.
              </p>
            </>
          )}
        </div>
      ) : loading ? (
        <div className="p-12 text-center text-sm text-muted">Đang tải bảng bảo trì…</div>
      ) : (
        <div className="space-y-4">
          {requestsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              Lỗi tải phiếu bảo trì: {requestsError}
            </div>
          )}
          {reportsError && canReadReports && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              Lỗi tải báo hỏng: {reportsError}
            </div>
          )}

          {requestsPartial && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">Chỉ tải được một phần danh sách phiếu bảo trì.</div>}
          <div className={`kanban ${canReadReports ? "" : "!grid-cols-3"}`}>
            {/* Cột Báo hỏng mới tiếp nhận: QUAN_LY/SALE/ADMIN được đọc, chỉ QUAN_LY/ADMIN được xử lý */}
            {canReadReports && (
              <section className="kanban-col">
                <header>
                  <span className="dot dot-coral" />
                  <b>Mới tiếp nhận</b>
                  {!canManageReports && <Pill tone="slate">Chỉ đọc</Pill>}
                  <span className="ml-auto text-xs font-bold text-muted">
                    {reportsError ? "!" : pendingReports.length}
                  </span>
                </header>

                {reportsError ? (
                  <div className="p-4 text-center text-xs text-red-500">
                    Không thể tải dữ liệu báo hỏng.
                  </div>
                ) : pendingReports.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted">Chưa có báo hỏng chờ duyệt.</div>
                ) : (
                  pendingReports.map((r) => (
                    <article key={r.id} className="ticket">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold text-muted">
                          BÁO HỎNG #{r.id}
                        </span>
                        <Pill tone="coral">Chờ duyệt</Pill>
                      </div>
                      <h3>{r.title}</h3>
                      <p className="text-xs text-muted mt-1 line-clamp-2">{r.description}</p>
                      <div className="flex items-center gap-1 text-xs text-muted mt-2">
                        <Icon name="pin" size={12} />
                        Phòng #{r.roomId}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                        {canManageReports ? (
                          <button
                            className="text-button font-bold text-teal"
                            onClick={() => setSelectedReport(r)}
                          >
                            Phân công <Icon name="arrow" size={12} />
                          </button>
                        ) : (
                          <span className="font-semibold text-muted">Chỉ đọc</span>
                        )}
                        <span className="text-muted">{toVNTime(r.createdAt, true)}</span>
                      </div>
                    </article>
                  ))
                )}
              </section>
            )}

            {/* Các cột phiếu bảo trì (cả KY_THUAT và QUAN_LY/ADMIN đều xem được) */}
            <section className="kanban-col">
              <header>
                <span className="dot dot-amber" />
                <b>Đã phân công</b>
                <span className="ml-auto text-xs font-bold text-muted">
                  {requestsError ? "!" : assignedRequests.length}
                </span>
              </header>
              {requestsError ? (
                <div className="p-4 text-center text-xs text-red-500">Lỗi tải danh sách.</div>
              ) : assignedRequests.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted">Không có phiếu đang chờ làm.</div>
              ) : (
                assignedRequests.map((t) => (
                  <article key={t.id} className="ticket">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-muted">
                        PHIẾU #{t.id}
                      </span>
                      <Pill tone={prioTone[t.priority] || "slate"}>
                        {prioLabel[t.priority] || t.priority}
                      </Pill>
                    </div>
                    <h3>Yêu cầu bảo trì phòng #{t.roomId}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted mt-1">
                      <Icon name="pin" size={12} />
                      Phòng #{t.roomId} {t.applianceId ? `· Thiết bị #${t.applianceId}` : ""}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="avatar-chip !h-6 !w-6">KT</span>
                        Kỹ thuật #{t.staffId}
                      </span>
                      <span className="text-muted">{toVNTime(t.createdAt, true)}</span>
                    </div>
                  </article>
                ))
              )}
            </section>

            <section className="kanban-col">
              <header>
                <span className="dot dot-sky" />
                <b>Đang xử lý</b>
                <span className="ml-auto text-xs font-bold text-muted">
                  {requestsError ? "!" : inProgressRequests.length}
                </span>
              </header>
              {requestsError ? (
                <div className="p-4 text-center text-xs text-red-500">Lỗi tải danh sách.</div>
              ) : inProgressRequests.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted">Không có phiếu đang sửa.</div>
              ) : (
                inProgressRequests.map((t) => (
                  <article key={t.id} className="ticket">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-muted">
                        PHIẾU #{t.id}
                      </span>
                      <Pill tone={prioTone[t.priority] || "slate"}>
                        {prioLabel[t.priority] || t.priority}
                      </Pill>
                    </div>
                    <h3>Yêu cầu bảo trì phòng #{t.roomId}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted mt-1">
                      <Icon name="pin" size={12} />
                      Phòng #{t.roomId} {t.applianceId ? `· Thiết bị #${t.applianceId}` : ""}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="avatar-chip !h-6 !w-6">KT</span>
                        Kỹ thuật #{t.staffId}
                      </span>
                      <span className="text-muted">{toVNTime(t.createdAt, true)}</span>
                    </div>
                  </article>
                ))
              )}
            </section>

            <section className="kanban-col">
              <header>
                <span className="dot dot-teal" />
                <b>Hoàn tất</b>
                <span className="ml-auto text-xs font-bold text-muted">
                  {requestsError ? "!" : completedRequests.length}
                </span>
              </header>
              {requestsError ? (
                <div className="p-4 text-center text-xs text-red-500">Lỗi tải danh sách.</div>
              ) : completedRequests.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted">Chưa có phiếu hoàn thành.</div>
              ) : (
                completedRequests.map((t) => (
                  <article key={t.id} className="ticket">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-muted">
                        PHIẾU #{t.id}
                      </span>
                      <Pill tone={prioTone[t.priority] || "slate"}>
                        {prioLabel[t.priority] || t.priority}
                      </Pill>
                    </div>
                    <h3>Yêu cầu bảo trì phòng #{t.roomId}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted mt-1">
                      <Icon name="pin" size={12} />
                      Phòng #{t.roomId} {t.applianceId ? `· Thiết bị #${t.applianceId}` : ""}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="avatar-chip !h-6 !w-6">KT</span>
                        Kỹ thuật #{t.staffId}
                      </span>
                      <span className="text-muted">{toVNTime(t.createdAt, true)}</span>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        </div>
      )}

      {/* Drawer phê duyệt & phân công báo hỏng (chỉ mở cho QUAN_LY / ADMIN) */}
      {canManageReports && (
        <Drawer
          open={!!selectedReport}
          eyebrow={selectedReport ? `Báo hỏng #${selectedReport.id}` : ""}
          title="Tiếp nhận & Phân công"
          onClose={() => setSelectedReport(null)}
          footer={
            <>
              <button
                className="danger-button mr-auto"
                disabled={rejecting || approving}
                onClick={() => void handleReject()}
              >
                {rejecting ? "Đang từ chối…" : "Từ chối"}
              </button>
              <button className="secondary-button" onClick={() => setSelectedReport(null)}>
                Hủy
              </button>
              <button
                className="primary-button"
                disabled={approving || rejecting || !assignStaffId || buildingTechs.length === 0}
                onClick={() => void handleApprove()}
              >
                {approving ? "Đang duyệt…" : "Duyệt & Phân công"}
              </button>
            </>
          }
        >
          {selectedReport && (
            <div className="form-grid">
              <div className="span-2">
                <h4 className="font-bold text-base">{selectedReport.title}</h4>
                <p className="text-sm text-muted mt-1">{selectedReport.description}</p>
              </div>
              {selectedReport.imageUrls && selectedReport.imageUrls.length > 0 && (
                <div className="span-2 grid grid-cols-3 gap-2">
                  {selectedReport.imageUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                  ))}
                </div>
              )}
              <Field label="Nhân viên kỹ thuật phụ trách">
                {staffLoadError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
                    Không thể tải danh sách kỹ thuật viên: {staffLoadError}
                  </div>
                ) : buildingTechs.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                    Không có kỹ thuật viên nào được phân công tại Tòa #{buildingId}. Vui lòng phân công kỹ thuật viên cho tòa nhà này trước khi duyệt.
                  </div>
                ) : (
                  <select
                    className="select"
                    value={assignStaffId}
                    onChange={(e) => setAssignStaffId(e.target.value)}
                  >
                    {buildingTechs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName ? `${t.fullName} (Mã #${t.id})` : `Kỹ thuật viên #${t.id}`}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Mức độ ưu tiên">
                <select
                  className="select"
                  value={assignPriority}
                  onChange={(e) => setAssignPriority(e.target.value as any)}
                >
                  <option value="LOW">Thấp</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HIGH">Cao</option>
                  <option value="URGENT">Khẩn cấp</option>
                </select>
              </Field>
              <Field label="Hẹn thời gian kiểm tra">
                <input
                  type="datetime-local"
                  value={assignScheduledAt}
                  onChange={(e) => setAssignScheduledAt(e.target.value)}
                />
              </Field>
              <Field label="Gắn ID thiết bị (nếu có)">
                <input
                  type="number"
                  value={assignApplianceId}
                  onChange={(e) => setAssignApplianceId(e.target.value)}
                  placeholder="Để trống nếu không có"
                />
              </Field>
              <div className="span-2">
                <Field label="Lý do từ chối (nếu từ chối yêu cầu)">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Lý do từ chối..."
                  />
                </Field>
              </div>
            </div>
          )}
        </Drawer>
      )}

      {toast}
    </>
  );
}
