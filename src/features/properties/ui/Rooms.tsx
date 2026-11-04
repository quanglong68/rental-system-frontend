import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Drawer, Field, Icon, PageHead, Pill, vnd, formatMoneyInput, parseMoneyInput, type Tone } from "@/shared/ui";
import { useAuth, hasAnyRole } from "@/features/auth";
import { propertyApi, type Building, type Page, type Room, type RoomStatistics, type RoomType } from "@/features/properties/api/propertyApi";
import { listingApi, type ListingItem, type PageResponse as ListingPage } from "@/api/listing";
import { idStr } from "@/shared/lib/id";
import { useBuildingLookup } from "@/shared/lib/refLabels";
import { roomStatuses } from "./BuildingRoomsPage";
import { usePropertyConfirm } from "./usePropertyConfirm";
import "./property.css";

const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Không tải được dữ liệu phòng.";

// Backend chỉ cho bật lại tin khi phòng VACANT/UPCOMING_VACANT (nếu không trả 422).
const canActivateListing = (listing: ListingItem) =>
  listing.roomStatus === "VACANT" || listing.roomStatus === "UPCOMING_VACANT";

type ListingForm = {
  id: string;
  title: string;
  description: string;
  depositAmount: string;
  electricityPrice: string;
  waterPrice: string;
  waterUnit: "" | "M3" | "PERSON";
  paymentMethod: "" | "CASH" | "BANK_TRANSFER";
  paymentDueDay: string;
  minTermMonths: string;
  availableFrom: string;
};

const toForm = (listing: ListingItem): ListingForm => ({
  id: idStr(listing.id),
  title: listing.title,
  description: listing.description ?? "",
  depositAmount: listing.depositAmount != null ? formatMoneyInput(listing.depositAmount) : "",
  electricityPrice: listing.electricityPrice != null ? formatMoneyInput(listing.electricityPrice) : "",
  waterPrice: listing.waterPrice != null ? formatMoneyInput(listing.waterPrice) : "",
  waterUnit: listing.waterUnit ?? "",
  paymentMethod: listing.paymentMethod ?? "",
  paymentDueDay: listing.paymentDueDay != null ? String(listing.paymentDueDay) : "",
  minTermMonths: listing.minTermMonths != null ? String(listing.minTermMonths) : "",
  availableFrom: listing.availableFrom ?? "",
});

const numberOrUndefined = (value: string) => (value.trim() === "" ? undefined : Number(value));
const moneyOrUndefined = (value: string) => {
  const v = parseMoneyInput(value);
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

const hasCompleteTerms = (listing: ListingItem) =>
  listing.depositAmount != null &&
  listing.electricityPrice != null &&
  listing.waterPrice != null &&
  listing.waterUnit != null &&
  listing.paymentMethod != null &&
  listing.paymentDueDay != null &&
  listing.minTermMonths != null;

export default function Rooms() {
  const { user } = useAuth();
  const canManageRoomTypes = hasAnyRole(user, ["ADMIN", "QUAN_LY"]);
  const canManageListings = hasAnyRole(user, ["ADMIN", "QUAN_LY", "SALE"]);
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
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [listingBuildingId, setListingBuildingId] = useState("");
  const [listingStatus, setListingStatus] = useState("");
  const [listingPage, setListingPage] = useState(0);
  const [listings, setListings] = useState<ListingPage<ListingItem> | null>(null);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState("");
  const [listingsReload, setListingsReload] = useState(0);
  const [listingActionId, setListingActionId] = useState<string | null>(null);
  const [listingForm, setListingForm] = useState<ListingForm | null>(null);
  const [listingSaving, setListingSaving] = useState(false);
  const [listingFormError, setListingFormError] = useState("");

  const buildingOf = useBuildingLookup(rooms?.content.map((room) => room.buildingId) ?? []);

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
    if (!canManageRoomTypes) return;
    const controller = new AbortController();
    propertyApi.roomTypes(controller.signal).then((result) => setTypes(result.content)).catch((cause) => { if (!controller.signal.aborted) setTypeError(errorMessage(cause)); });
    return () => controller.abort();
  }, [canManageRoomTypes]);
  useEffect(() => {
    if (!canManageListings) return;
    const controller = new AbortController();
    propertyApi.buildings(0, 100, "", "", "", "", controller.signal).then((result) => setBuildings(result.content)).catch(() => {});
    return () => controller.abort();
  }, [canManageListings]);
  useEffect(() => {
    if (!canManageListings) return;
    const controller = new AbortController();
    setListingsLoading(true); setListingsError("");
    listingApi.manage({buildingId: listingBuildingId || undefined, status: listingStatus || undefined, page: listingPage, size: 10})
      .then(setListings)
      .catch((cause) => { if (!controller.signal.aborted) setListingsError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setListingsLoading(false); });
    return () => controller.abort();
  }, [canManageListings, listingBuildingId, listingStatus, listingPage, listingsReload]);
  const saveListing = async (event: FormEvent) => {
    event.preventDefault(); if (!listingForm) return;
    setListingSaving(true); setListingFormError("");
    try {
      await listingApi.update(listingForm.id, {
        title: listingForm.title.trim(),
        description: listingForm.description.trim() || undefined,
        depositAmount: moneyOrUndefined(listingForm.depositAmount),
        electricityPrice: moneyOrUndefined(listingForm.electricityPrice),
        waterPrice: moneyOrUndefined(listingForm.waterPrice),
        waterUnit: listingForm.waterUnit || undefined,
        paymentMethod: listingForm.paymentMethod || undefined,
        paymentDueDay: numberOrUndefined(listingForm.paymentDueDay),
        minTermMonths: numberOrUndefined(listingForm.minTermMonths),
        availableFrom: listingForm.availableFrom || undefined,
      });
      setListingForm(null); setListingsReload((v) => v + 1);
    } catch (cause) { setListingFormError(errorMessage(cause)); } finally { setListingSaving(false); }
  };
  const toggleListing = async (listing: ListingItem) => {
    const next = listing.status === "ACTIVE" ? "CLOSED" : "ACTIVE";
    if (next === "ACTIVE" && !canActivateListing(listing)) {
      setListingsError(`Phòng ${listing.roomNumber} không còn trống (${listing.roomStatus}) nên không thể bật hiển thị tin.`);
      return;
    }
    const label = next === "ACTIVE" ? "Bật hiển thị tin" : "Đóng tin";
    if (!await confirm({title: label, message: `Phòng ${listing.roomNumber}: ${label.toLowerCase()} “${listing.title}”?`, confirmLabel: label})) return;
    setListingActionId(idStr(listing.id)); setListingsError("");
    try { await listingApi.updateStatus(listing.id, next); setListingsReload((v) => v + 1); }
    catch (cause) { setListingsError(errorMessage(cause)); }
    finally { setListingActionId(null); }
  };
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
        <article className="panel"><span>Phòng ở ghép (≥2 người)</span><strong>{statistics?.operatingRooms ?? "—"}</strong></article>
        <article className="panel"><span>Cần kiểm tra, cập nhật</span><strong>{statistics?.roomsNeedingUpdate ?? "—"}</strong></article>
        <p className="property-note">Số liệu tính đến {statistics?.businessDate ?? "đang tải…"}. “Phòng ở ghép” chỉ tính phòng có từ 2 cư dân trở lên; dữ liệu cần kiểm tra là gợi ý đối soát, không tự thay đổi trạng thái phòng.</p>
      </>}
    </section>}
    <section className="panel room-global-list">
      <div className="property-toolbar"><label className="field-search"><Icon name="search" size={16}/><input aria-label="Sắp xếp danh sách phòng" readOnly placeholder="Sắp xếp danh sách bằng bộ chọn bên cạnh" /></label>
        <select className="select" aria-label="Sắp xếp phòng" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }}><option value="createdAt,desc">Mới tạo trước</option><option value="updatedAt,desc">Cập nhật gần đây</option><option value="roomCode,asc">Mã phòng A–Z</option><option value="roomCode,desc">Mã phòng Z–A</option><option value="status,asc">Theo trạng thái</option><option value="basePrice,asc">Giá tăng dần</option><option value="basePrice,desc">Giá giảm dần</option></select>
      </div>
      {error && <div className="property-state" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setReload((v) => v + 1)}>Thử tải lại</button></div>}
      {!error && loading && <div className="property-state" role="status">Đang tải phòng…</div>}
      {!error && !loading && rooms?.content.length === 0 && <div className="property-state">Chưa có phòng trong hệ thống.</div>}
      {!!rooms?.content.length && <div className="property-table-wrap"><table className="data-table"><thead><tr><th>Mã phòng</th><th>Tòa nhà</th><th>Diện tích</th><th>Giá cơ bản</th><th>Sức chứa</th><th>Trạng thái</th></tr></thead><tbody>{rooms.content.map((room) => <tr key={room.id}><td><Link className="property-link" to={`/admin/buildings/${room.buildingId}/rooms/${room.id}`}>{room.roomCode}</Link></td><td>{buildingOf(room.buildingId) ?? `Tòa #${idStr(room.buildingId)}`}</td><td>{room.area} m²</td><td>{vnd(room.basePrice)}</td><td>{room.maxCapacity}</td><td><Pill tone={roomStatuses[room.status]?.tone ?? "slate"}>{roomStatuses[room.status]?.label ?? room.status}</Pill></td></tr>)}</tbody></table></div>}
      {rooms && rooms.totalPages > 1 && <div className="property-pagination"><span>Trang {page + 1}/{rooms.totalPages} · {rooms.totalElements} phòng</span><button className="secondary-button" disabled={page === 0} onClick={() => setPage((v) => v - 1)}>Trước</button><button className="secondary-button" disabled={page + 1 >= rooms.totalPages} onClick={() => setPage((v) => v + 1)}>Sau</button></div>}
    </section>
    {canManageRoomTypes && <section className="panel room-type-panel"><div className="room-section-heading room-panel-heading"><div><h2 className="text-lg font-bold">Loại phòng</h2><p className="text-sm text-muted">Quản lý danh mục dùng khi tạo và sửa phòng.</p></div><button className="primary-button" onClick={() => { setTypeForm({typeCode: "", name: "", description: ""}); setTypeError(""); setTypeDrawer(true); }}>Thêm loại phòng</button></div>
      {typeError && <p className="field-error" role="alert">{typeError}</p>}
      <div className="property-table-wrap"><table className="data-table"><thead><tr><th>Mã</th><th>Tên</th><th>Mô tả</th><th></th></tr></thead><tbody>{types.map((type) => <tr key={type.id}><td>{type.typeCode}</td><td>{type.name}</td><td>{type.description || "—"}</td><td><div className="room-row-actions"><button type="button" onClick={() => { setTypeForm({id: type.id, typeCode: type.typeCode, name: type.name, description: type.description ?? ""}); setTypeError(""); setTypeDrawer(true); }}>Sửa</button><button type="button" className="danger-text-button" onClick={() => void deleteType(type)}>Xóa</button></div></td></tr>)}</tbody></table></div>
    </section>}
    {canManageListings && <section className="panel">
      <div className="room-section-heading room-panel-heading">
        <div><h2 className="text-lg font-bold">Tin đăng cho thuê</h2><p className="text-sm text-muted">Tin tự sinh khi phòng trống; nhập đủ tiền cọc, điện, nước, hình thức trả và kỳ hạn để khách gửi được yêu cầu thuê.</p></div>
        <div className="room-row-actions">
          <select className="select" aria-label="Lọc tin theo tòa nhà" value={listingBuildingId} onChange={(e) => { setListingBuildingId(e.target.value); setListingPage(0); }}><option value="">Tất cả tòa nhà</option>{buildings.map((building) => <option key={idStr(building.buildingId)} value={idStr(building.buildingId)}>{building.name}</option>)}</select>
          <select className="select" aria-label="Lọc tin theo trạng thái" value={listingStatus} onChange={(e) => { setListingStatus(e.target.value); setListingPage(0); }}><option value="">Mọi trạng thái</option><option value="ACTIVE">Đang hiển thị</option><option value="CLOSED">Đã đóng</option></select>
        </div>
      </div>
      {listingsError && <div className="property-state" role="alert"><p>{listingsError}</p><button className="secondary-button" onClick={() => setListingsReload((v) => v + 1)}>Thử tải lại</button></div>}
      {!listingsError && listingsLoading && <div className="property-state" role="status">Đang tải tin đăng…</div>}
      {!listingsError && !listingsLoading && listings?.content.length === 0 && <div className="property-state">Chưa có tin đăng phù hợp.</div>}
      {!!listings?.content.length && <div className="property-table-wrap"><table className="data-table room-listing-table"><thead><tr><th>Phòng</th><th>Tiêu đề</th><th>Giá</th><th>Điều khoản thuê</th><th>Trạng thái phòng</th><th>Tin đăng</th><th></th></tr></thead><tbody>{listings.content.map((listing) => {
        const listingId = idStr(listing.id);
        const busy = listingActionId === listingId;
        const cannotActivate = listing.status !== "ACTIVE" && !canActivateListing(listing);
        return <tr key={listingId}><td>{listing.roomNumber} · {listing.buildingName}</td><td>{listing.title}</td><td>{vnd(listing.price)}</td><td>{hasCompleteTerms(listing) ? <div className="listing-terms"><span>Cọc <b>{vnd(listing.depositAmount ?? 0)}</b></span><span>Điện {vnd(listing.electricityPrice ?? 0)}/kWh · Nước {vnd(listing.waterPrice ?? 0)}/{listing.waterUnit === "M3" ? "m³" : "người"}</span><span>{listing.minTermMonths} tháng · hạn ngày {listing.paymentDueDay}{listing.availableFrom ? ` · vào từ ${listing.availableFrom.split("-").reverse().join("/")}` : ""}</span></div> : <Pill tone="coral">Thiếu điều khoản</Pill>}</td><td>{(() => { const info = (roomStatuses as Record<string, {label: string; tone: Tone}>)[listing.roomStatus]; return <Pill tone={info?.tone ?? "slate"}>{info?.label ?? listing.roomStatus}</Pill>; })()}</td><td><Pill tone={listing.status === "ACTIVE" ? "teal" : "slate"}>{listing.status === "ACTIVE" ? "Đang hiển thị" : "Đã đóng"}</Pill></td><td><div className="room-row-actions"><button type="button" onClick={() => { setListingForm(toForm(listing)); setListingFormError(""); }}>Sửa tin</button><button type="button" className={listing.status === "ACTIVE" ? "danger-text-button" : ""} disabled={busy || cannotActivate} title={cannotActivate ? "Chỉ bật hiển thị khi phòng trống hoặc sắp trống" : undefined} onClick={() => void toggleListing(listing)}>{busy ? "Đang lưu…" : listing.status === "ACTIVE" ? "Đóng tin" : "Bật hiển thị"}</button></div></td></tr>;
      })}</tbody></table></div>}
      {listings && listings.totalPages > 1 && <div className="property-pagination"><span>Trang {listingPage + 1}/{listings.totalPages} · {listings.totalElements} tin</span><button className="secondary-button" disabled={listingPage === 0} onClick={() => setListingPage((v) => v - 1)}>Trước</button><button className="secondary-button" disabled={listingPage + 1 >= listings.totalPages} onClick={() => setListingPage((v) => v + 1)}>Sau</button></div>}
    </section>}
    <Drawer open={!!listingForm} wide title="Sửa tin đăng &amp; điều khoản thuê" eyebrow="Khách chỉ gửi được yêu cầu khi đủ điều khoản" onClose={() => setListingForm(null)} footer={<><button className="secondary-button" onClick={() => setListingForm(null)}>Hủy</button><button className="primary-button" form="listing-form" disabled={listingSaving}>{listingSaving ? "Đang lưu…" : "Lưu tin đăng"}</button></>}>
      <form id="listing-form" className="property-form" onSubmit={saveListing}>
        <Field label="Tiêu đề"><input required maxLength={200} value={listingForm?.title ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, title: e.target.value} : form)}/></Field>
        <Field label="Mô tả"><textarea value={listingForm?.description ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, description: e.target.value} : form)}/></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tiền cọc (VND)" hint={listingForm?.depositAmount ? `${parseMoneyInput(listingForm.depositAmount).toLocaleString("vi-VN")} ₫` : undefined}><input inputMode="numeric" value={listingForm?.depositAmount ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, depositAmount: formatMoneyInput(e.target.value)} : form)}/></Field>
          <Field label="Giá điện (VND/kWh)" hint={listingForm?.electricityPrice ? `${parseMoneyInput(listingForm.electricityPrice).toLocaleString("vi-VN")} ₫` : undefined}><input inputMode="numeric" value={listingForm?.electricityPrice ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, electricityPrice: formatMoneyInput(e.target.value)} : form)}/></Field>
          <Field label="Giá nước (VND)" hint={listingForm?.waterPrice ? `${parseMoneyInput(listingForm.waterPrice).toLocaleString("vi-VN")} ₫` : undefined}><input inputMode="numeric" value={listingForm?.waterPrice ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, waterPrice: formatMoneyInput(e.target.value)} : form)}/></Field>
          <Field label="Cách tính nước"><select value={listingForm?.waterUnit ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, waterUnit: e.target.value as ListingForm["waterUnit"]} : form)}><option value="">Chọn cách tính</option><option value="M3">Theo m³</option><option value="PERSON">Theo người</option></select></Field>
          <Field label="Hình thức thanh toán"><select value={listingForm?.paymentMethod ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, paymentMethod: e.target.value as ListingForm["paymentMethod"]} : form)}><option value="">Chọn hình thức</option><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></select></Field>
          <Field label="Hạn thanh toán trong tháng" hint="Từ ngày 1 đến 28"><input type="number" min={1} max={28} value={listingForm?.paymentDueDay ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, paymentDueDay: e.target.value} : form)}/></Field>
          <Field label="Thời hạn hợp đồng (tháng)"><input type="number" min={1} value={listingForm?.minTermMonths ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, minTermMonths: e.target.value} : form)}/></Field>
          <Field label="Có thể vào ở từ" hint="Để trống nếu nhận ngay khi ký"><input type="date" value={listingForm?.availableFrom ?? ""} onChange={(e) => setListingForm((form) => form ? {...form, availableFrom: e.target.value} : form)}/></Field>
        </div>
        <p className="text-xs text-muted">Thông tin chủ nhà (họ tên, CCCD, địa chỉ) được lấy từ hồ sơ tòa nhà và tự động ghi vào hợp đồng.</p>
        {listingFormError && <p className="field-error" role="alert">{listingFormError}</p>}
      </form>
    </Drawer>
    <Drawer open={typeDrawer} title={typeForm.id ? "Sửa loại phòng" : "Thêm loại phòng"} onClose={() => setTypeDrawer(false)} footer={<><button className="secondary-button" onClick={() => setTypeDrawer(false)}>Hủy</button><button className="primary-button" form="room-type-form" disabled={typeSaving}>{typeSaving ? "Đang lưu…" : "Lưu loại phòng"}</button></>}>
      <form id="room-type-form" className="property-form" onSubmit={saveType}><Field label="Mã loại phòng"><input required maxLength={50} value={typeForm.typeCode} onChange={(e) => setTypeForm({...typeForm, typeCode: e.target.value})}/></Field><Field label="Tên loại phòng"><input required maxLength={100} value={typeForm.name} onChange={(e) => setTypeForm({...typeForm, name: e.target.value})}/></Field><Field label="Mô tả"><textarea value={typeForm.description} onChange={(e) => setTypeForm({...typeForm, description: e.target.value})}/></Field>{typeError && <p className="field-error" role="alert">{typeError}</p>}</form>
    </Drawer>
  </>;
}
