import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Drawer, Field, Icon, PageHead, Pill, vnd } from "@/shared/ui";
import { useAuth } from "@/features/auth";
import { propertyApi, type Page, type Room, type RoomStatistics, type RoomType } from "@/features/properties/api/propertyApi";
import { roomStatuses } from "./BuildingRoomsPage";
import { usePropertyConfirm } from "./usePropertyConfirm";
import "./property.css";

const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Không tải được dữ liệu phòng.";

export default function Rooms() {
  const { user } = useAuth();
  const [confirmationPopup, confirm] = usePropertyConfirm();
  const [rooms, setRooms] = useState<Page<Room> | null>(null);
  const [statistics, setStatistics] = useState<RoomStatistics | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("createdAt,desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [reload, setReload] = useState(0);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [typeForm, setTypeForm] = useState<{id?: string; typeCode: string; name: string; description: string}>({typeCode: "", name: "", description: ""});
  const [typeDrawer, setTypeDrawer] = useState(false);
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState("");

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    propertyApi.rooms(undefined, page, sort, controller.signal).then(setRooms).catch((cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, sort, reload]);
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    const controller = new AbortController();
    propertyApi.roomStatistics(undefined, controller.signal).then(setStatistics).catch((cause) => { if (!controller.signal.aborted) setStatsError(errorMessage(cause)); });
    return () => controller.abort();
  }, [user?.role]);
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    const controller = new AbortController();
    propertyApi.roomTypes(controller.signal).then((result) => setTypes(result.content)).catch((cause) => { if (!controller.signal.aborted) setTypeError(errorMessage(cause)); });
    return () => controller.abort();
  }, [user?.role]);
  const saveType = async (event: FormEvent) => {
    event.preventDefault(); setTypeSaving(true); setTypeError("");
    try {
      const input = {typeCode: typeForm.typeCode.trim(), name: typeForm.name.trim(), description: typeForm.description.trim() || null};
      if (typeForm.id) await propertyApi.updateRoomType(typeForm.id, input); else await propertyApi.createRoomType(input);
      setTypes((await propertyApi.roomTypes()).content); setTypeDrawer(false);
    } catch (cause) { setTypeError(errorMessage(cause)); } finally { setTypeSaving(false); }
  };
  const deleteType = async (type: RoomType) => {
    if (!await confirm({title: "Xóa loại phòng", message: `Xóa loại phòng “${type.name}”?`, confirmLabel: "Xóa loại phòng"})) return;
    try { await propertyApi.deleteRoomType(type.id); setTypes((await propertyApi.roomTypes()).content); }
    catch (cause) { setTypeError(errorMessage(cause)); }
  };

  return <>
    {confirmationPopup}
    <PageHead eyebrow="Khai thác" title="Phòng" desc="Danh sách phòng trên toàn hệ thống và tình hình khai thác." />
    {user?.role === "ADMIN" && <section className="room-stat-grid" aria-label="Thống kê phòng">
      {statsError ? <div className="property-location-error" role="alert">{statsError}</div> : <>
        <article className="panel"><span>Tổng phòng</span><strong>{statistics?.totalRooms ?? "—"}</strong></article>
        <article className="panel"><span>Phòng đang khai thác</span><strong>{statistics?.operatingRooms ?? "—"}</strong></article>
        <article className="panel"><span>Cần kiểm tra, cập nhật</span><strong>{statistics?.roomsNeedingUpdate ?? "—"}</strong></article>
        <p className="property-note">Số liệu tính đến {statistics?.businessDate ?? "đang tải…"}. Dữ liệu cần kiểm tra là gợi ý đối soát, không tự thay đổi trạng thái phòng.</p>
      </>}
    </section>}
    <section className="panel room-global-list">
      <div className="property-toolbar"><label className="field-search"><Icon name="search" size={16}/><input aria-label="Sắp xếp danh sách phòng" readOnly placeholder="Sắp xếp danh sách bằng bộ chọn bên cạnh" /></label>
        <select className="select" aria-label="Sắp xếp phòng" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }}><option value="createdAt,desc">Mới tạo trước</option><option value="updatedAt,desc">Cập nhật gần đây</option><option value="roomCode,asc">Mã phòng A–Z</option><option value="roomCode,desc">Mã phòng Z–A</option><option value="status,asc">Theo trạng thái</option><option value="basePrice,asc">Giá tăng dần</option><option value="basePrice,desc">Giá giảm dần</option></select>
      </div>
      {error && <div className="property-state" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setReload((v) => v + 1)}>Thử tải lại</button></div>}
      {!error && loading && <div className="property-state" role="status">Đang tải phòng…</div>}
      {!error && !loading && rooms?.content.length === 0 && <div className="property-state">Chưa có phòng trong hệ thống.</div>}
      {!!rooms?.content.length && <div className="property-table-wrap"><table className="data-table"><thead><tr><th>Mã phòng</th><th>Tòa nhà</th><th>Diện tích</th><th>Giá cơ bản</th><th>Sức chứa</th><th>Trạng thái</th></tr></thead><tbody>{rooms.content.map((room) => <tr key={room.id}><td><Link className="property-link" to={`/admin/buildings/${room.buildingId}/rooms/${room.id}`}>{room.roomCode}</Link></td><td>{room.buildingId}</td><td>{room.area} m²</td><td>{vnd(room.basePrice)}</td><td>{room.maxCapacity}</td><td><Pill tone={roomStatuses[room.status]?.tone ?? "slate"}>{roomStatuses[room.status]?.label ?? room.status}</Pill></td></tr>)}</tbody></table></div>}
      {rooms && rooms.totalPages > 1 && <div className="property-pagination"><span>Trang {page + 1}/{rooms.totalPages} · {rooms.totalElements} phòng</span><button className="secondary-button" disabled={page === 0} onClick={() => setPage((v) => v - 1)}>Trước</button><button className="secondary-button" disabled={rooms.last} onClick={() => setPage((v) => v + 1)}>Sau</button></div>}
      {user?.role === "ADMIN" && <p className="property-note">ID tòa nhà được giữ nguyên theo phản hồi API; mở chi tiết phòng để xem tên tòa nhà và chỉnh sửa.</p>}
    </section>
    {user?.role === "ADMIN" && <section className="panel room-type-panel"><div className="room-section-heading"><div><h2 className="text-lg font-bold">Loại phòng</h2><p className="text-sm text-muted">Quản lý danh mục dùng khi tạo và sửa phòng.</p></div><button className="primary-button" onClick={() => { setTypeForm({typeCode: "", name: "", description: ""}); setTypeError(""); setTypeDrawer(true); }}>Thêm loại phòng</button></div>
      {typeError && <p className="field-error" role="alert">{typeError}</p>}
      <div className="property-table-wrap"><table className="data-table"><thead><tr><th>Mã</th><th>Tên</th><th>Mô tả</th><th></th></tr></thead><tbody>{types.map((type) => <tr key={type.id}><td>{type.typeCode}</td><td>{type.name}</td><td>{type.description || "—"}</td><td><div className="room-row-actions"><button type="button" onClick={() => { setTypeForm({id: type.id, typeCode: type.typeCode, name: type.name, description: type.description ?? ""}); setTypeError(""); setTypeDrawer(true); }}>Sửa</button><button type="button" className="danger-text-button" onClick={() => void deleteType(type)}>Xóa</button></div></td></tr>)}</tbody></table></div>
    </section>}
    <Drawer open={typeDrawer} title={typeForm.id ? "Sửa loại phòng" : "Thêm loại phòng"} onClose={() => setTypeDrawer(false)} footer={<><button className="secondary-button" onClick={() => setTypeDrawer(false)}>Hủy</button><button className="primary-button" form="room-type-form" disabled={typeSaving}>{typeSaving ? "Đang lưu…" : "Lưu loại phòng"}</button></>}>
      <form id="room-type-form" className="property-form" onSubmit={saveType}><Field label="Mã loại phòng"><input required maxLength={50} value={typeForm.typeCode} onChange={(e) => setTypeForm({...typeForm, typeCode: e.target.value})}/></Field><Field label="Tên loại phòng"><input required maxLength={100} value={typeForm.name} onChange={(e) => setTypeForm({...typeForm, name: e.target.value})}/></Field><Field label="Mô tả"><textarea value={typeForm.description} onChange={(e) => setTypeForm({...typeForm, description: e.target.value})}/></Field>{typeError && <p className="field-error" role="alert">{typeError}</p>}</form>
    </Drawer>
  </>;
}
