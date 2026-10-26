import { useCallback, useEffect, useState } from "react";
import { Drawer, Field, Icon, MiniStat, PageHead, Pill, Tabs, Toolbar, toVNTime, todayVN, useToast, type Tone } from "@/shared/ui";
import { useAuth } from "@/features/auth";
import { getMyProfile, getStaff, type UserProfile } from "@/api/userNotification";
import { fetchPagedHistory } from "@/api/pagedHistory";
import {
  assetApi,
  type Appliance,
  type MaintenanceReport,
  type MaintenanceSchedule,
} from "@/api/assetMaintenance";

const stateTone: Record<string, Tone> = {
  GOOD: "teal",
  NEEDS_REPAIR: "amber",
  BROKEN: "coral",
};

const stateLabel: Record<string, string> = {
  GOOD: "Tốt",
  NEEDS_REPAIR: "Cần sửa",
  BROKEN: "Hỏng",
};

export default function Assets() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isTech = user?.role === "KY_THUAT";
  const canManageAssets = user?.role === "QUAN_LY" || isAdmin;
  const canManageReports = canManageAssets;

  // Đặc tả 9.6: chỉ QUAN_LY/ADMIN xem và xử lý báo hỏng; SALE chỉ đọc thiết bị/lịch trong scope.
  const availableTabs = canManageReports ? ["Báo hỏng", "Thiết bị", "Định kỳ"] : ["Thiết bị", "Định kỳ"];
  const [tab, setTab] = useState(canManageReports ? "Báo hỏng" : "Thiết bị");

  const [availableBuildings, setAvailableBuildings] = useState<number[]>([]);
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [allTechnicians, setAllTechnicians] = useState<UserProfile[]>([]);
  const [staffLoadError, setStaffLoadError] = useState<string | null>(null);

  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsPartial, setReportsPartial] = useState(false);

  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loadingAppliances, setLoadingAppliances] = useState(false);
  const [appliancesError, setAppliancesError] = useState<string | null>(null);
  const [appliancesPartial, setAppliancesPartial] = useState(false);

  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [toast, show] = useToast();

  // Modal approve report
  const [selectedReport, setSelectedReport] = useState<MaintenanceReport | null>(null);
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignPriority, setAssignPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("HIGH");
  const [assignScheduledAt, setAssignScheduledAt] = useState("");
  const [assignApplianceId, setAssignApplianceId] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Modal add appliance
  const [addingAppliance, setAddingAppliance] = useState(false);
  const [newRoomId, setNewRoomId] = useState("");
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("GOOD");
  const [savingAppliance, setSavingAppliance] = useState(false);

  // Edit / Delete appliance
  const [editingAppliance, setEditingAppliance] = useState<Appliance | null>(null);
  const [editApplianceName, setEditApplianceName] = useState("");
  const [editApplianceStatus, setEditApplianceStatus] = useState<"GOOD" | "NEEDS_REPAIR" | "BROKEN">("GOOD");
  const [savingEditAppliance, setSavingEditAppliance] = useState(false);
  const [deletingApplianceId, setDeletingApplianceId] = useState<number | null>(null);

  // Modal warranty
  const [warrantyAppliance, setWarrantyAppliance] = useState<Appliance | null>(null);
  const [warrantyProvider, setWarrantyProvider] = useState("");
  const [warrantyStart, setWarrantyStart] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [savingWarranty, setSavingWarranty] = useState(false);

  // Maintenance Schedule CRUD & Complete
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [newScheduleTitle, setNewScheduleTitle] = useState("");
  const [newScheduleDesc, setNewScheduleDesc] = useState("");
  const [newScheduleStaffId, setNewScheduleStaffId] = useState("");
  const [newScheduleInterval, setNewScheduleInterval] = useState(3);
  const [newScheduleFirstDate, setNewScheduleFirstDate] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | null>(null);
  const [editScheduleTitle, setEditScheduleTitle] = useState("");
  const [editScheduleDesc, setEditScheduleDesc] = useState("");
  const [editScheduleStaffId, setEditScheduleStaffId] = useState("");
  const [editScheduleInterval, setEditScheduleInterval] = useState(3);
  const [editScheduleNextDate, setEditScheduleNextDate] = useState("");
  const [savingEditSchedule, setSavingEditSchedule] = useState(false);

  const [completingScheduleId, setCompletingScheduleId] = useState<number | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(null);

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
        } else if (bList.length > 0) {
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
    } catch {
      setAvailableBuildings([]);
      setBuildingId(null);
    } finally {
      setLoadingBuildings(false);
    }
  }, [isAdmin]);

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

  const loadReports = useCallback(async () => {
    if (!canManageReports || buildingId == null) {
      setReports([]);
      setReportsError(null);
      setReportsPartial(false);
      return;
    }
    setLoadingReports(true);
    setReportsError(null);
    setReportsPartial(false);
    try {
      const history = await fetchPagedHistory(
        (page, size) => assetApi.reportsPage(buildingId, undefined, page, size),
      );
      setReports(history.items);
      setReportsPartial(!history.complete);
    } catch (err) {
      setReportsError(err instanceof Error ? err.message : "Không thể tải danh sách báo hỏng từ máy chủ.");
      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  }, [buildingId, canManageReports]);

  const loadAppliances = useCallback(async () => {
    if (buildingId == null) {
      setAppliances([]);
      setAppliancesError(null);
      setAppliancesPartial(false);
      return;
    }
    setLoadingAppliances(true);
    setAppliancesError(null);
    setAppliancesPartial(false);
    try {
      const history = await fetchPagedHistory(
        (page, size) => assetApi.appliancesPage(`?buildingId=${buildingId}&page=${page}&size=${size}`),
      );
      setAppliances(history.items);
      setAppliancesPartial(!history.complete);
    } catch (err) {
      setAppliancesError(err instanceof Error ? err.message : "Không thể tải danh mục thiết bị từ máy chủ.");
      setAppliances([]);
    } finally {
      setLoadingAppliances(false);
    }
  }, [buildingId]);

  const loadSchedules = useCallback(async () => {
    if (buildingId == null) {
      setSchedules([]);
      setSchedulesError(null);
      return;
    }
    setLoadingSchedules(true);
    setSchedulesError(null);
    try {
      const data = await assetApi.schedules(buildingId);
      setSchedules(data || []);
    } catch (err) {
      setSchedulesError(err instanceof Error ? err.message : "Không thể tải lịch bảo trì định kỳ từ máy chủ.");
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  }, [buildingId]);

  useEffect(() => {
    void loadReports();
    void loadAppliances();
    void loadSchedules();
  }, [loadReports, loadAppliances, loadSchedules]);

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
      show("Đã duyệt báo hỏng và tạo phiếu kỹ thuật.");
      setSelectedReport(null);
      await loadReports();
    } catch (e) {
      show(e instanceof Error ? e.message : "Duyệt báo hỏng thất bại.");
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
      await loadReports();
    } catch (e) {
      show(e instanceof Error ? e.message : "Từ chối báo hỏng thất bại.");
    } finally {
      setRejecting(false);
    }
  };

  const handleCreateAppliance = async () => {
    if (!canManageAssets) {
      show("Chỉ Quản lý hoặc Quản trị viên mới có quyền thêm thiết bị.");
      return;
    }
    if (!newName.trim() || !newRoomId) {
      show("Vui lòng nhập tên thiết bị và ID phòng.");
      return;
    }
    setSavingAppliance(true);
    try {
      await assetApi.createAppliance({
        roomId: Number(newRoomId),
        name: newName.trim(),
        status: newStatus,
      });
      show("Đã thêm thiết bị mới.");
      setAddingAppliance(false);
      setNewName("");
      setNewRoomId("");
      await loadAppliances();
    } catch (e) {
      show(e instanceof Error ? e.message : "Thêm thiết bị thất bại.");
    } finally {
      setSavingAppliance(false);
    }
  };

  const handleSaveWarranty = async () => {
    if (!canManageAssets) {
      show("Chỉ Quản lý hoặc Quản trị viên mới có quyền cập nhật bảo hành.");
      return;
    }
    if (!warrantyAppliance || !warrantyProvider.trim() || !warrantyStart || !warrantyEnd) {
      show("Vui lòng điền đủ thông tin bảo hành.");
      return;
    }
    setSavingWarranty(true);
    try {
      await assetApi.updateWarranty(warrantyAppliance.id, {
        provider: warrantyProvider.trim(),
        startDate: warrantyStart,
        endDate: warrantyEnd,
      });
      show("Đã cập nhật bảo hành thiết bị.");
      setWarrantyAppliance(null);
      await loadAppliances();
    } catch (e) {
      show(e instanceof Error ? e.message : "Cập nhật bảo hành thất bại.");
    } finally {
      setSavingWarranty(false);
    }
  };

  const handleUpdateAppliance = async () => {
    if (!canManageAssets || !editingAppliance) return;
    if (!editApplianceName.trim()) {
      show("Vui lòng nhập tên thiết bị.");
      return;
    }
    setSavingEditAppliance(true);
    try {
      await assetApi.updateAppliance(editingAppliance.id, {
        name: editApplianceName.trim(),
        status: editApplianceStatus,
      });
      show("Đã cập nhật thông tin thiết bị.");
      setEditingAppliance(null);
      await loadAppliances();
    } catch (e) {
      show(e instanceof Error ? e.message : "Cập nhật thiết bị thất bại.");
    } finally {
      setSavingEditAppliance(false);
    }
  };

  const handleDeleteAppliance = async (id: number) => {
    if (!canManageAssets) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa thiết bị này?")) return;
    setDeletingApplianceId(id);
    try {
      await assetApi.deleteAppliance(id);
      show("Đã xóa thiết bị thành công.");
      await loadAppliances();
    } catch (e) {
      show(e instanceof Error ? e.message : "Xóa thiết bị thất bại.");
    } finally {
      setDeletingApplianceId(null);
    }
  };

  const handleCreateSchedule = async () => {
    if (!canManageAssets || buildingId == null) return;
    if (!newScheduleTitle.trim() || !newScheduleStaffId || !newScheduleFirstDate) {
      show("Vui lòng nhập tiêu đề, kỹ thuật viên và ngày bắt đầu.");
      return;
    }
    setSavingSchedule(true);
    try {
      await assetApi.createSchedule({
        buildingId,
        staffId: Number(newScheduleStaffId),
        title: newScheduleTitle.trim(),
        description: newScheduleDesc.trim() || undefined,
        intervalMonths: Number(newScheduleInterval) || 1,
        firstDate: newScheduleFirstDate,
      });
      show("Đã tạo lịch bảo trì định kỳ.");
      setAddingSchedule(false);
      setNewScheduleTitle("");
      setNewScheduleDesc("");
      setNewScheduleStaffId("");
      await loadSchedules();
    } catch (e) {
      show(e instanceof Error ? e.message : "Tạo lịch bảo trì thất bại.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!canManageAssets || !editingSchedule) return;
    if (!editScheduleTitle.trim() || !editScheduleStaffId || !editScheduleNextDate) {
      show("Vui lòng nhập đầy đủ thông tin lịch bảo trì.");
      return;
    }
    setSavingEditSchedule(true);
    try {
      await assetApi.updateSchedule(editingSchedule.id, {
        staffId: Number(editScheduleStaffId),
        title: editScheduleTitle.trim(),
        description: editScheduleDesc.trim() || undefined,
        intervalMonths: Number(editScheduleInterval) || 1,
        nextDate: editScheduleNextDate,
      });
      show("Đã cập nhật lịch bảo trì định kỳ.");
      setEditingSchedule(null);
      await loadSchedules();
    } catch (e) {
      show(e instanceof Error ? e.message : "Cập nhật lịch bảo trì thất bại.");
    } finally {
      setSavingEditSchedule(false);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!canManageAssets) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa lịch bảo trì này?")) return;
    setDeletingScheduleId(id);
    try {
      await assetApi.deleteSchedule(id);
      show("Đã xóa lịch bảo trì định kỳ.");
      await loadSchedules();
    } catch (e) {
      show(e instanceof Error ? e.message : "Xóa lịch bảo trì thất bại.");
    } finally {
      setDeletingScheduleId(null);
    }
  };

  const handleCompleteSchedule = async (id: number) => {
    setCompletingScheduleId(id);
    try {
      await assetApi.completeSchedule(id);
      show("Đã ghi nhận hoàn tất bảo trì định kỳ.");
      await loadSchedules();
    } catch (e) {
      show(e instanceof Error ? e.message : "Hoàn tất bảo trì thất bại.");
    } finally {
      setCompletingScheduleId(null);
    }
  };

  const pendingReports = reports.filter((r) => r.status === "PENDING");
  const filteredAppliances = appliances.filter((a) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return a.name.toLowerCase().includes(q) || String(a.roomId).includes(q);
  });

  return (
    <>
      <PageHead
        eyebrow="Vận hành"
        title="Tài sản & Bảo trì định kỳ"
        desc={
          isTech
            ? "Danh mục thiết bị theo phòng, thông tin bảo hành và lịch bảo trì định kỳ."
            : "Danh mục thiết bị theo phòng, thông tin bảo hành và tiếp nhận báo hỏng từ khách thuê."
        }
        actions={
          <div className="flex items-center gap-2">
            {availableBuildings.length > 0 ? (
              <select
                className="select !h-[40px]"
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
            <Tabs items={availableTabs} value={tab} onChange={setTab} />
            {canManageAssets && tab === "Thiết bị" && (
              <button className="primary-button" onClick={() => setAddingAppliance(true)}>
                <Icon name="plus" size={16} /> Thêm thiết bị
              </button>
            )}
            {canManageAssets && tab === "Định kỳ" && (
              <button
                className="primary-button"
                disabled={buildingId == null}
                onClick={() => {
                  setAddingSchedule(true);
                  setNewScheduleFirstDate(todayVN());
                  if (buildingTechs.length > 0) {
                    setNewScheduleStaffId(String(buildingTechs[0].id));
                  }
                }}
              >
                <Icon name="plus" size={16} /> Thêm lịch bảo trì
              </button>
            )}
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
      ) : (
        <>
          <section className="stats-grid mb-6">
            <MiniStat
              label="Thiết bị tại tòa"
              value={appliancesError ? "!" : String(appliances.length)}
              note={buildingId ? `Tòa #${buildingId}` : "Chưa chọn tòa"}
            />
            <MiniStat
              label="Hoạt động tốt"
              value={appliancesError ? "!" : String(appliances.filter((a) => a.status === "GOOD").length)}
              note="Trạng thái GOOD"
              tone="teal"
            />
            <MiniStat
              label="Cần sửa / Hỏng"
              value={appliancesError ? "!" : String(appliances.filter((a) => a.status !== "GOOD").length)}
              note="Cần kiểm tra"
              tone="coral"
            />
            {canManageReports && (
              <MiniStat
                label="Báo hỏng chờ duyệt"
                value={reportsError ? "!" : String(pendingReports.length)}
                note="Chờ quản lý duyệt"
                tone="amber"
              />
            )}
          </section>

          {tab === "Báo hỏng" && canManageReports && (
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>Báo hỏng từ khách thuê</h2>
                  <p>{canManageReports ? "Xem ảnh, duyệt yêu cầu, gắn thiết bị và phân công kỹ thuật" : "Xem báo hỏng trong phạm vi tòa nhà được phân công"}</p>
                </div>
              </div>
              {reportsPartial && <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Chỉ tải được một phần danh sách báo hỏng.</div>}
              {loadingReports ? (
                <div className="p-10 text-center text-sm text-muted">Đang tải báo hỏng…</div>
              ) : reportsError ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-red-600 mb-2">{reportsError}</p>
                  <button className="secondary-button" onClick={() => void loadReports()}>
                    Thử lại
                  </button>
                </div>
              ) : reports.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted">Không có báo hỏng nào tại tòa này.</div>
              ) : (
                <div className="space-y-3 p-4">
                  {reports.map((r) => (
                    <div key={r.id} className="approval border-b border-line pb-3 last:border-b-0">
                      {r.imageUrls && r.imageUrls.length > 0 ? (
                        <div className="flex -space-x-2 overflow-hidden">
                          {r.imageUrls.slice(0, 3).map((img, i) => (
                            <img
                              key={i}
                              src={img}
                              alt=""
                              className="h-11 w-11 rounded-lg border-2 border-white object-cover"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-muted">
                          <Icon name="tools" size={18} />
                        </div>
                      )}
                      <div className="min-w-[220px] flex-1">
                        <b className="text-sm">{r.title}</b>
                        <p className="text-xs text-muted mt-0.5 line-clamp-1">{r.description}</p>
                        <div className="text-xs text-muted mt-1">
                          Phòng #{r.roomId} · Khách #{r.customerId} · {toVNTime(r.createdAt, true)} · Trạng thái:{" "}
                          <span className="font-semibold text-ink">{r.status}</span>
                        </div>
                      </div>
                      {r.status === "PENDING" && canManageReports && (
                        <button className="primary-button !h-9" onClick={() => setSelectedReport(r)}>
                          Xử lý <Icon name="arrow" size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          )}

          {tab === "Thiết bị" && (
            <article className="panel">
              <Toolbar placeholder="Tìm tên thiết bị, mã phòng..." value={query} onChange={(e) => setQuery(e.target.value)} />
              {appliancesPartial && <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Chỉ tải được một phần danh mục thiết bị.</div>}
              {loadingAppliances ? (
                <div className="p-10 text-center text-sm text-muted">Đang tải danh mục thiết bị…</div>
              ) : appliancesError ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-red-600 mb-2">{appliancesError}</p>
                  <button className="secondary-button" onClick={() => void loadAppliances()}>
                    Thử lại
                  </button>
                </div>
              ) : filteredAppliances.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted">Chưa có thiết bị nào được ghi nhận.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Thiết bị</th>
                        <th>Vị trí phòng</th>
                        <th>Tình trạng</th>
                        <th>Bảo hành</th>
                        {canManageAssets && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppliances.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <b>{a.name}</b>
                            <div className="sub font-mono">#{a.id}</div>
                          </td>
                          <td className="text-[13px]">Phòng #{a.roomId}</td>
                          <td>
                            <Pill tone={stateTone[a.status] || "slate"}>
                              {stateLabel[a.status] || a.status}
                            </Pill>
                          </td>
                          <td className="whitespace-nowrap text-xs">
                            {a.warrantyEndDate ? (
                              <div>
                                <div>{toVNTime(a.warrantyEndDate)}</div>
                                <small className="text-muted">{a.warrantyProvider}</small>
                              </div>
                            ) : (
                              <span className="text-muted">Chưa cập nhật</span>
                            )}
                          </td>
                          {canManageAssets && (
                            <td className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    setEditingAppliance(a);
                                    setEditApplianceName(a.name);
                                    setEditApplianceStatus(a.status);
                                  }}
                                >
                                  Sửa
                                </button>
                                <button
                                  className="text-button text-red-600"
                                  disabled={deletingApplianceId === a.id}
                                  onClick={() => void handleDeleteAppliance(a.id)}
                                >
                                  {deletingApplianceId === a.id ? "Đang xóa…" : "Xóa"}
                                </button>
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    setWarrantyAppliance(a);
                                    setWarrantyProvider(a.warrantyProvider || "");
                                    setWarrantyStart(a.warrantyStartDate || "");
                                    setWarrantyEnd(a.warrantyEndDate || "");
                                  }}
                                >
                                  Bảo hành <Icon name="chevron" size={12} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          )}

          {tab === "Định kỳ" && (
            <div className="grid gap-4 md:grid-cols-2">
              {loadingSchedules ? (
                <div className="col-span-2 p-10 text-center text-sm text-muted">Đang tải lịch bảo trì định kỳ…</div>
              ) : schedulesError ? (
                <div className="col-span-2 p-10 text-center">
                  <p className="text-sm text-red-600 mb-2">{schedulesError}</p>
                  <button className="secondary-button" onClick={() => void loadSchedules()}>
                    Thử lại
                  </button>
                </div>
              ) : schedules.length === 0 ? (
                <div className="col-span-2 p-10 text-center text-sm text-muted">
                  Chưa có lịch bảo trì định kỳ nào cho tòa nhà này.
                </div>
              ) : (
                schedules.map((s) => (
                  <article key={s.id} className="panel p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Pill tone="sky">Mỗi {s.intervalMonths} tháng</Pill>
                        <h3 className="mt-3 text-base font-extrabold">{s.title}</h3>
                        {s.description && <div className="text-xs text-muted">{s.description}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-muted">Kỹ thuật viên</div>
                        <div className="text-sm font-semibold">#{s.staffId}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                      <span>Lần trước: {s.lastDoneDate ? toVNTime(s.lastDoneDate) : "—"}</span>
                      <span>Kế tiếp: <b className="text-ink">{toVNTime(s.nextDate)}</b></span>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-3">
                      {(canManageAssets || (isTech && user?.id && s.staffId === Number(user.id))) && (
                        <button
                          className="primary-button !py-1 !px-3 text-xs"
                          disabled={completingScheduleId === s.id}
                          onClick={() => void handleCompleteSchedule(s.id)}
                        >
                          {completingScheduleId === s.id ? "Đang hoàn tất…" : "Hoàn tất bảo trì"}
                        </button>
                      )}
                      {canManageAssets && (
                        <>
                          <button
                            className="secondary-button !py-1 !px-3 text-xs"
                            onClick={() => {
                              setEditingSchedule(s);
                              setEditScheduleTitle(s.title);
                              setEditScheduleDesc(s.description || "");
                              setEditScheduleStaffId(String(s.staffId));
                              setEditScheduleInterval(s.intervalMonths);
                              setEditScheduleNextDate(s.nextDate);
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            className="danger-button !py-1 !px-3 text-xs"
                            disabled={deletingScheduleId === s.id}
                            onClick={() => void handleDeleteSchedule(s.id)}
                          >
                            {deletingScheduleId === s.id ? "Đang xóa…" : "Xóa"}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Drawer xử lý báo hỏng (chỉ dành cho QUAN_LY / ADMIN) */}
      {canManageReports && (
        <Drawer
          open={!!selectedReport}
          eyebrow={selectedReport ? `Báo hỏng #${selectedReport.id}` : ""}
          title="Xử lý báo hỏng"
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
              <Field label="Độ ưu tiên">
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
              <Field label="Thời gian hẹn kiểm tra">
                <input
                  type="datetime-local"
                  value={assignScheduledAt}
                  onChange={(e) => setAssignScheduledAt(e.target.value)}
                />
              </Field>
              <Field label="Gắn ID thiết bị (tùy chọn)">
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
                    placeholder="Ví dụ: Sự cố không thuộc danh mục hỗ trợ..."
                  />
                </Field>
              </div>
            </div>
          )}
        </Drawer>
      )}

      {/* Drawer thêm thiết bị (chỉ dành cho QUAN_LY / ADMIN) */}
      {canManageAssets && (
        <Drawer
          open={addingAppliance}
          eyebrow="Tài sản"
          title="Thêm thiết bị mới"
          onClose={() => setAddingAppliance(false)}
          footer={
            <>
              <button className="secondary-button" onClick={() => setAddingAppliance(false)}>
                Hủy
              </button>
              <button
                className="primary-button"
                disabled={savingAppliance}
                onClick={() => void handleCreateAppliance()}
              >
                {savingAppliance ? "Đang lưu…" : "Lưu thiết bị"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="span-2">
              <Field label="Tên thiết bị">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Máy lạnh Daikin 1.5HP"
                />
              </Field>
            </div>
            <Field label="ID Phòng">
              <input
                type="number"
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                placeholder="101"
              />
            </Field>
            <Field label="Tình trạng">
              <select
                className="select"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="GOOD">Tốt</option>
                <option value="NEEDS_REPAIR">Cần sửa</option>
                <option value="BROKEN">Hỏng</option>
              </select>
            </Field>
          </div>
        </Drawer>
      )}

      {/* Drawer bảo hành (chỉ dành cho QUAN_LY / ADMIN) */}
      {canManageAssets && (
        <Drawer
          open={!!warrantyAppliance}
          eyebrow="Bảo hành"
          title={warrantyAppliance ? `Bảo hành: ${warrantyAppliance.name}` : ""}
          onClose={() => setWarrantyAppliance(null)}
          footer={
            <>
              <button className="secondary-button" onClick={() => setWarrantyAppliance(null)}>
                Hủy
              </button>
              <button
                className="primary-button"
                disabled={savingWarranty}
                onClick={() => void handleSaveWarranty()}
              >
                {savingWarranty ? "Đang lưu…" : "Cập nhật"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="span-2">
              <Field label="Đơn vị cung cấp bảo hành">
                <input
                  value={warrantyProvider}
                  onChange={(e) => setWarrantyProvider(e.target.value)}
                  placeholder="Điện máy Xanh / Daikin Việt Nam"
                />
              </Field>
            </div>
            <Field label="Ngày bắt đầu">
              <input
                type="date"
                value={warrantyStart}
                onChange={(e) => setWarrantyStart(e.target.value)}
              />
            </Field>
            <Field label="Ngày kết thúc">
              <input
                type="date"
                value={warrantyEnd}
                onChange={(e) => setWarrantyEnd(e.target.value)}
              />
            </Field>
          </div>
        </Drawer>
      )}

      {/* Drawer sửa thiết bị (chỉ dành cho QUAN_LY / ADMIN) */}
      {canManageAssets && (
        <Drawer
          open={!!editingAppliance}
          eyebrow="Tài sản"
          title={editingAppliance ? `Sửa thiết bị: ${editingAppliance.name}` : ""}
          onClose={() => setEditingAppliance(null)}
          footer={
            <>
              <button className="secondary-button" onClick={() => setEditingAppliance(null)}>
                Hủy
              </button>
              <button
                className="primary-button"
                disabled={savingEditAppliance}
                onClick={() => void handleUpdateAppliance()}
              >
                {savingEditAppliance ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="span-2">
              <Field label="Tên thiết bị">
                <input
                  value={editApplianceName}
                  onChange={(e) => setEditApplianceName(e.target.value)}
                  placeholder="Tên thiết bị..."
                />
              </Field>
            </div>
            <div className="span-2">
              <Field label="Tình trạng">
                <select
                  className="select"
                  value={editApplianceStatus}
                  onChange={(e) => setEditApplianceStatus(e.target.value as any)}
                >
                  <option value="GOOD">Tốt</option>
                  <option value="NEEDS_REPAIR">Cần sửa</option>
                  <option value="BROKEN">Hỏng</option>
                </select>
              </Field>
            </div>
          </div>
        </Drawer>
      )}

      {/* Drawer thêm lịch bảo trì định kỳ (chỉ dành cho QUAN_LY / ADMIN) */}
      {canManageAssets && (
        <Drawer
          open={addingSchedule}
          eyebrow="Định kỳ"
          title="Thêm lịch bảo trì định kỳ"
          onClose={() => setAddingSchedule(false)}
          footer={
            <>
              <button className="secondary-button" onClick={() => setAddingSchedule(false)}>
                Hủy
              </button>
              <button
                className="primary-button"
                disabled={savingSchedule || !newScheduleStaffId || buildingTechs.length === 0}
                onClick={() => void handleCreateSchedule()}
              >
                {savingSchedule ? "Đang lưu…" : "Tạo lịch"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="span-2">
              <Field label="Tiêu đề lịch bảo trì">
                <input
                  value={newScheduleTitle}
                  onChange={(e) => setNewScheduleTitle(e.target.value)}
                  placeholder="Ví dụ: Bảo trì thang máy định kỳ"
                />
              </Field>
            </div>
            <div className="span-2">
              <Field label="Mô tả công việc (tùy chọn)">
                <input
                  value={newScheduleDesc}
                  onChange={(e) => setNewScheduleDesc(e.target.value)}
                  placeholder="Kiểm tra hệ thống cáp, phanh và bôi trơn ray..."
                />
              </Field>
            </div>
            <Field label="Kỹ thuật viên phụ trách">
              {staffLoadError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                  {staffLoadError}
                </div>
              ) : buildingTechs.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  Không có kỹ thuật viên tại Tòa #{buildingId}
                </div>
              ) : (
                <select
                  className="select"
                  value={newScheduleStaffId}
                  onChange={(e) => setNewScheduleStaffId(e.target.value)}
                >
                  {buildingTechs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName ? `${t.fullName} (Mã #${t.id})` : `Kỹ thuật viên #${t.id}`}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Chu kỳ bảo trì">
              <select
                className="select"
                value={newScheduleInterval}
                onChange={(e) => setNewScheduleInterval(Number(e.target.value))}
              >
                <option value={1}>Mỗi 1 tháng</option>
                <option value={2}>Mỗi 2 tháng</option>
                <option value={3}>Mỗi 3 tháng (Quý)</option>
                <option value={6}>Mỗi 6 tháng</option>
                <option value={12}>Mỗi 12 tháng (Năm)</option>
              </select>
            </Field>
            <div className="span-2">
              <Field label="Ngày thực hiện lần đầu">
                <input
                  type="date"
                  value={newScheduleFirstDate}
                  onChange={(e) => setNewScheduleFirstDate(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Drawer>
      )}

      {/* Drawer sửa lịch bảo trì định kỳ (chỉ dành cho QUAN_LY / ADMIN) */}
      {canManageAssets && (
        <Drawer
          open={!!editingSchedule}
          eyebrow="Định kỳ"
          title={editingSchedule ? `Sửa lịch: ${editingSchedule.title}` : ""}
          onClose={() => setEditingSchedule(null)}
          footer={
            <>
              <button className="secondary-button" onClick={() => setEditingSchedule(null)}>
                Hủy
              </button>
              <button
                className="primary-button"
                disabled={savingEditSchedule || !editScheduleStaffId}
                onClick={() => void handleUpdateSchedule()}
              >
                {savingEditSchedule ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="span-2">
              <Field label="Tiêu đề lịch bảo trì">
                <input
                  value={editScheduleTitle}
                  onChange={(e) => setEditScheduleTitle(e.target.value)}
                />
              </Field>
            </div>
            <div className="span-2">
              <Field label="Mô tả công việc (tùy chọn)">
                <input
                  value={editScheduleDesc}
                  onChange={(e) => setEditScheduleDesc(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Kỹ thuật viên phụ trách">
              {buildingTechs.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  Không có kỹ thuật viên tại Tòa #{buildingId}
                </div>
              ) : (
                <select
                  className="select"
                  value={editScheduleStaffId}
                  onChange={(e) => setEditScheduleStaffId(e.target.value)}
                >
                  {buildingTechs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName ? `${t.fullName} (Mã #${t.id})` : `Kỹ thuật viên #${t.id}`}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Chu kỳ bảo trì">
              <select
                className="select"
                value={editScheduleInterval}
                onChange={(e) => setEditScheduleInterval(Number(e.target.value))}
              >
                <option value={1}>Mỗi 1 tháng</option>
                <option value={2}>Mỗi 2 tháng</option>
                <option value={3}>Mỗi 3 tháng (Quý)</option>
                <option value={6}>Mỗi 6 tháng</option>
                <option value={12}>Mỗi 12 tháng (Năm)</option>
              </select>
            </Field>
            <div className="span-2">
              <Field label="Ngày thực hiện tiếp theo">
                <input
                  type="date"
                  value={editScheduleNextDate}
                  onChange={(e) => setEditScheduleNextDate(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Drawer>
      )}

      {toast}
    </>
  );
}
