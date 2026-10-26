import {useEffect, useState, type FormEvent} from "react";
import {Link, Navigate, useNavigate, useParams} from "react-router";
import {Drawer, Field, PageHead, Pill, Tabs, vnd} from "@/shared/ui";
import {
    propertyApi,
    type Building,
    type OccupancySummary,
    type Occupant,
    type Page,
    type Room,
    type RoomImage,
    type RoomPrice,
    type RoomType
} from "@/features/properties/api/propertyApi";
import PropertyBreadcrumbs from "./PropertyBreadcrumbs";
import {roomStatuses} from "./BuildingRoomsPage";
import {usePropertyConfirm} from "./usePropertyConfirm";
import "./property.css";

const tabs = ["Tổng quan", "Người cư trú", "Hợp đồng", "Lịch sử"];
export default function RoomDetailPage() {
    const {buildingId, roomId} = useParams();
    const navigate = useNavigate();
    const [confirmationPopup, confirm] = usePropertyConfirm();
    const [building, setBuilding] = useState<Building | null>(null);
    const [room, setRoom] = useState<Room | null>(null);
    const [summary, setSummary] = useState<OccupancySummary | null>(null);
    const [occupants, setOccupants] = useState<Page<Occupant> | null>(null);
    const [tab, setTab] = useState(tabs[0]);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [error, setError] = useState("");
    const [listError, setListError] = useState("");
    const [reload, setReload] = useState(0);
    const [editing, setEditing] = useState(false);
    const [roomForm, setRoomForm] = useState<Room | null>(null);
    const [types, setTypes] = useState<RoomType[]>([]);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [prices, setPrices] = useState<RoomPrice[]>([]);
    const [currentPrice, setCurrentPrice] = useState<RoomPrice | null>(null);
    const [price, setPrice] = useState("");
    const [effectiveFrom, setEffectiveFrom] = useState(new Date().toLocaleDateString("sv-SE", {timeZone: "Asia/Ho_Chi_Minh"}));
    const [priceError, setPriceError] = useState("");
    const [images, setImages] = useState<RoomImage[]>([]);
    const [imageError, setImageError] = useState("");
    const [imageBusy, setImageBusy] = useState(false);

    useEffect(() => {
        if (!buildingId || !roomId) return;
        const controller = new AbortController();
        setLoading(true);
        setError("");
        Promise.all([propertyApi.building(buildingId, controller.signal), propertyApi.room(roomId, controller.signal)]).then(([b, r]) => {
            if (r.buildingId !== buildingId) throw new Error("Phòng không thuộc tòa nhà này.");
            setBuilding(b);
            setRoom(r);
        }).catch((cause) => {
            if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được phòng.");
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [buildingId, roomId, reload]);
    useEffect(() => {
        if (!roomId || !room || (tab !== "Người cư trú" && tab !== "Lịch sử")) return;
        const controller = new AbortController();
        setListLoading(true);
        setListError("");
        Promise.all([propertyApi.occupants(roomId, page, tab === "Lịch sử", controller.signal), propertyApi.occupancySummary(roomId, controller.signal)]).then(([list, occupancy]) => {
            setOccupants(list);
            setSummary(occupancy);
        }).catch((cause) => {
            if (!controller.signal.aborted) setListError(cause instanceof Error ? cause.message : "Không tải được thông tin cư trú.");
        }).finally(() => {
            if (!controller.signal.aborted) setListLoading(false);
        });
        return () => controller.abort();
    }, [roomId, room, tab, page, reload]);

    useEffect(() => {
        if (!roomId || !room || tab !== "Tổng quan") return;
        const controller = new AbortController();
        propertyApi.roomPrices(roomId, controller.signal).then(setPrices).catch((cause) => { if (!controller.signal.aborted) setPriceError(cause instanceof Error ? cause.message : "Không tải được lịch sử giá."); });
        propertyApi.roomImages(roomId, controller.signal).then((roomImages) => setImages(roomImages.sort((a, b) => a.displayOrder - b.displayOrder))).catch((cause) => { if (!controller.signal.aborted) setImageError(cause instanceof Error ? cause.message : "Không tải được ảnh phòng."); });
        propertyApi.currentRoomPrice(roomId, undefined, controller.signal).then(setCurrentPrice).catch(() => { if (!controller.signal.aborted) setCurrentPrice(null); });
        return () => controller.abort();
    }, [roomId, room, tab, reload]);

    const openEdit = async () => {
        if (!room) return;
        setRoomForm(room); setFormError(""); setEditing(true);
        try { setTypes((await propertyApi.roomTypes()).content); } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Không tải được loại phòng."); }
    };
    const saveRoom = async (event: FormEvent) => {
        event.preventDefault(); if (!roomId || !roomForm) return;
        setSaving(true); setFormError("");
        try {
            const {buildingId: roomBuildingId, roomTypeId, roomCode, maxCapacity, area, bedroomCount, bathroomCount, basePrice, status} = roomForm;
            await propertyApi.updateRoom(roomId, {buildingId: roomBuildingId, roomTypeId, roomCode, maxCapacity, area, bedroomCount, bathroomCount, basePrice, status});
            setEditing(false); setReload((value) => value + 1);
        } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Không cập nhật được phòng."); } finally { setSaving(false); }
    };
    const removeRoom = async () => {
        if (!roomId || !room || !await confirm({title: "Xóa phòng", message: `Bạn có chắc muốn xóa phòng ${room.roomCode}?`, confirmLabel: "Xóa phòng"})) return;
        try { await propertyApi.deleteRoom(roomId); navigate(`/admin/buildings/${buildingId}/rooms`, {replace: true}); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Không xóa được phòng."); }
    };
    const setNewPrice = async (event: FormEvent) => {
        event.preventDefault(); if (!roomId) return;
        setPriceError("");
        try { await propertyApi.setRoomPrice(roomId, Number(price), effectiveFrom); setPrice(""); setPrices(await propertyApi.roomPrices(roomId)); setCurrentPrice(await propertyApi.currentRoomPrice(roomId)); }
        catch (cause) { setPriceError(cause instanceof Error ? cause.message : "Không cập nhật được giá."); }
    };
    const refreshImages = async () => setImages((await propertyApi.roomImages(roomId!)).sort((a, b) => a.displayOrder - b.displayOrder));
    const uploadImage = async (file?: File) => {
        if (!file || !roomId) return; setImageBusy(true); setImageError("");
        try { await propertyApi.uploadRoomImage(roomId, file); await refreshImages(); }
        catch (cause) { setImageError(cause instanceof Error ? cause.message : "Không tải được ảnh."); } finally { setImageBusy(false); }
    };
    const updateImage = async (image: RoomImage, patch: Partial<Pick<RoomImage, "displayOrder" | "primaryImage">>) => {
        if (!roomId) return; setImageBusy(true); setImageError("");
        try { await propertyApi.updateRoomImage(roomId, image.imageId, patch); await refreshImages(); }
        catch (cause) { setImageError(cause instanceof Error ? cause.message : "Không cập nhật được ảnh."); } finally { setImageBusy(false); }
    };
    const removeImage = async (image: RoomImage) => {
        if (!roomId || !await confirm({title: "Xóa ảnh phòng", message: "Bạn có chắc muốn gỡ ảnh này khỏi phòng?", confirmLabel: "Xóa ảnh"})) return;
        setImageBusy(true); setImageError("");
        try { await propertyApi.deleteRoomImage(roomId, image.imageId); await refreshImages(); }
        catch (cause) { setImageError(cause instanceof Error ? cause.message : "Không xóa được ảnh."); } finally { setImageBusy(false); }
    };

    if (!buildingId || !roomId) return <Navigate to="/admin/buildings" replace/>;
    return <>
        {confirmationPopup}
        <PropertyBreadcrumbs building={building} room={room}/>
        <PageHead eyebrow="" title={room ? `Phòng ${room.roomCode}` : "Chi tiết phòng"}
                  desc={building ? `${building.name} · ${building.address}` : "Đang tải thông tin tòa nhà…"}
                  actions={<><Link className="secondary-button" to={`/admin/buildings/${buildingId}/rooms`}>Danh sách phòng</Link><button className="secondary-button" onClick={() => void openEdit()}>Sửa phòng</button><button className="danger-button" onClick={() => void removeRoom()}>Xóa phòng</button></>}/>
        {error && <div className="panel property-state" role="alert"><p>{error}</p>
            <button className="secondary-button" onClick={() => setReload((value) => value + 1)}>Thử lại</button>
        </div>}
        {!error && loading && <div className="panel property-state" role="status">Đang tải chi tiết phòng…</div>}
        {!error && !loading && room && <>
            <div className="panel property-detail-top">
                <div><span className="text-sm text-muted">Trạng thái hiện tại</span>
                    <div className="mt-2"><Pill
                        tone={roomStatuses[room.status]?.tone ?? "slate"}>{roomStatuses[room.status]?.label ?? room.status}</Pill>
                    </div>
                </div>
                <div><span className="text-sm text-muted">Giá hiện tại</span><strong>{vnd(currentPrice?.price ?? room.basePrice)}</strong></div>
                <div><span className="text-sm text-muted">Diện tích</span><strong>{room.area} m²</strong></div>
                <div><span className="text-sm text-muted">Sức chứa</span><strong>{room.maxCapacity} người</strong></div>
            </div>
            <Tabs items={tabs} value={tab} onChange={(value) => {
                setTab(value);
                setPage(0);
                setOccupants(null);
            }}/>
            {tab === "Tổng quan" && <div className="room-detail-sections">
                <section className="panel p-6"><h2 className="text-lg font-bold">Thông tin phòng</h2>
                    <dl className="property-details">
                        <div>
                            <dt>Mã phòng</dt>
                            <dd>{room.roomCode}</dd>
                        </div>
                        <div>
                            <dt>Diện tích</dt>
                            <dd>{room.area} m²</dd>
                        </div>
                        <div>
                            <dt>Loại phòng</dt>
                            <dd>{types.find((type) => type.id === room.roomTypeId)?.name ?? room.roomTypeId}</dd>
                        </div>
                        <div>
                            <dt>Phòng ngủ</dt>
                            <dd>{room.bedroomCount}</dd>
                        </div>
                        <div>
                            <dt>Phòng tắm</dt>
                            <dd>{room.bathroomCount}</dd>
                        </div>
                        <div>
                            <dt>Sức chứa tối đa</dt>
                            <dd>{room.maxCapacity} người</dd>
                        </div>
                    </dl>
                </section>
                <section className="panel p-6"><div className="room-section-heading"><div><h2 className="text-lg font-bold">Ảnh phòng</h2><p className="text-sm text-muted">JPEG, PNG hoặc WebP, tối đa 5 MiB mỗi ảnh.</p></div><label className="secondary-button">Thêm ảnh<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={(event) => { void uploadImage(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label></div>
                    {imageError && <p className="field-error" role="alert">{imageError}</p>}{images.length === 0 && <p className="property-note">Chưa có ảnh phòng.</p>}
                    <div className="room-image-grid">{images.map((image) => <figure key={image.imageId}><img src={image.imageUrl} alt={`Ảnh phòng ${room.roomCode}`} loading="lazy"/><figcaption>{image.primaryImage ? "Ảnh đại diện" : `Ảnh ${image.displayOrder + 1}`}</figcaption><div><button type="button" className="secondary-button" disabled={imageBusy || image.primaryImage} onClick={() => void updateImage(image, {primaryImage: true})}>Đặt ảnh đại diện</button><button type="button" className="danger-button" disabled={imageBusy} onClick={() => void removeImage(image)}>Xóa</button></div></figure>)}</div>
                </section>
                <section className="panel p-6"><h2 className="text-lg font-bold">Lịch sử giá</h2><form className="room-price-form" onSubmit={setNewPrice}><Field label="Giá mới (₫)"><input required type="number" min={0} value={price} onChange={(event) => setPrice(event.target.value)}/></Field><Field label="Ngày hiệu lực"><input required type="date" min={new Date().toLocaleDateString("sv-SE", {timeZone: "Asia/Ho_Chi_Minh"})} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)}/></Field><button className="primary-button">Áp dụng giá</button></form>{priceError && <p className="field-error" role="alert">{priceError}</p>}{prices.length ? <div className="property-table-wrap"><table className="data-table"><thead><tr><th>Giá</th><th>Từ ngày</th><th>Đến ngày</th></tr></thead><tbody>{prices.map((item) => <tr key={item.id}><td>{vnd(item.price)}</td><td>{item.effectiveFrom}</td><td>{item.effectiveTo ?? "Đang áp dụng"}</td></tr>)}</tbody></table></div> : <p className="property-note">Chưa có lịch sử giá.</p>}</section>
            </div>}
            {(tab === "Người cư trú" || tab === "Lịch sử") && <section className="panel">
                <div className="property-toolbar"><h2
                    className="text-lg font-bold">{tab === "Lịch sử" ? "Lịch sử cư trú" : "Người cư trú hiện tại"}</h2>{summary && tab === "Người cư trú" &&
                    <div className="room-capacity"><span>{summary.currentOccupants}/{summary.maxCapacity} người · còn {summary.availableCapacity} chỗ</span><div role="progressbar" aria-label="Mức sử dụng sức chứa" aria-valuenow={summary.currentOccupants} aria-valuemin={0} aria-valuemax={summary.maxCapacity}><span className={summary.overCapacity ? "is-over-capacity" : ""} style={{width: `${Math.min(100, Math.max(0, summary.currentOccupants / summary.maxCapacity * 100))}%`}}/></div></div>}
                </div>
                {listError && <div className="property-state" role="alert"><p>{listError}</p>
                    <button className="secondary-button" onClick={() => setReload((value) => value + 1)}>Thử lại
                    </button>
                </div>}{!listError && listLoading && <div className="property-state" role="status">Đang tải người cư
                trú…</div>}{!listError && !listLoading && occupants?.content.length === 0 && <div
                className="property-state">{tab === "Lịch sử" ? "Chưa có lịch sử cư trú." : "Hiện chưa có người cư trú trong phòng."}</div>}{!listError && !listLoading && !!occupants?.content.length &&
                <div className="property-table-wrap">
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>ID người dùng</th>
                            <th>Hợp đồng</th>
                            <th>Ngày vào</th>
                            <th>Ngày rời</th>
                            <th>Trạng thái</th>
                        </tr>
                        </thead>
                        <tbody>{occupants.content.map((person) => <tr key={person.id}>
                            <td>{person.userId}</td>
                            <td>{person.contractId}</td>
                            <td>{person.moveInDate}</td>
                            <td>{person.moveOutDate ?? "—"}</td>
                            <td><Pill
                                tone={person.status === "ACTIVE" ? "teal" : "slate"}>{person.status === "ACTIVE" ? "Đang cư trú" : "Đã rời"}</Pill>
                            </td>
                        </tr>)}</tbody>
                    </table>
                </div>}{!listError && !listLoading && occupants && occupants.totalPages > 1 &&
                <div className="property-pagination"><span>Trang {page + 1}/{occupants.totalPages}</span>
                    <button className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước
                    </button>
                    <button className="secondary-button" disabled={occupants.last}
                            onClick={() => setPage(page + 1)}>Sau
                    </button>
                </div>}<p className="property-note px-5 pb-5">API cư trú hiện trả về ID người dùng và hợp đồng; tên và
                thông tin liên hệ chưa có trong phản hồi này.</p></section>}
            {tab === "Hợp đồng" &&
                <div className="panel property-state">Thông tin hợp đồng theo phòng chưa có API đọc được xác
                    nhận.</div>}
        </>}
        <Drawer open={editing} title="Sửa thông tin phòng" onClose={() => setEditing(false)} footer={<><button className="secondary-button" onClick={() => setEditing(false)}>Hủy</button><button className="primary-button" form="room-edit-form" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button></>}>
            {roomForm && <form id="room-edit-form" className="property-form" onSubmit={saveRoom}><Field label="Mã phòng"><input required maxLength={50} value={roomForm.roomCode} onChange={(e) => setRoomForm({...roomForm, roomCode: e.target.value})}/></Field><Field label="Loại phòng"><select required value={roomForm.roomTypeId} onChange={(e) => setRoomForm({...roomForm, roomTypeId: e.target.value})}><option value="">Chọn loại phòng</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field><Field label="Sức chứa"><input required type="number" min={1} value={roomForm.maxCapacity} onChange={(e) => setRoomForm({...roomForm, maxCapacity: Number(e.target.value)})}/></Field><Field label="Diện tích (m²)"><input required type="number" min={0.01} step="any" value={roomForm.area} onChange={(e) => setRoomForm({...roomForm, area: Number(e.target.value)})}/></Field><Field label="Số phòng ngủ"><input required type="number" min={0} value={roomForm.bedroomCount} onChange={(e) => setRoomForm({...roomForm, bedroomCount: Number(e.target.value)})}/></Field><Field label="Số phòng tắm"><input required type="number" min={0} value={roomForm.bathroomCount} onChange={(e) => setRoomForm({...roomForm, bathroomCount: Number(e.target.value)})}/></Field><Field label="Giá cơ bản (₫)"><input required type="number" min={0} value={roomForm.basePrice} onChange={(e) => setRoomForm({...roomForm, basePrice: Number(e.target.value)})}/></Field><Field label="Trạng thái"><select value={roomForm.status} onChange={(e) => setRoomForm({...roomForm, status: e.target.value as Room["status"]})}><option value="VACANT">Phòng trống</option><option value="OCCUPIED">Đang thuê</option><option value="UPCOMING_VACANT">Sắp trống</option><option value="MAINTENANCE">Bảo trì</option></select></Field>{formError && <p className="field-error" role="alert">{formError}</p>}</form>}
        </Drawer>
    </>;
}
