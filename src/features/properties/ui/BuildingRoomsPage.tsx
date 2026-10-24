import {useEffect, useMemo, useState, type FormEvent} from "react";
import {Link, Navigate, useParams} from "react-router";
import {Drawer, Field, Icon, PageHead, Pill, vnd} from "@/shared/ui";
import {
    propertyApi,
    type Building,
    type Page,
    type Room,
    type RoomInput,
    type RoomType
} from "@/features/properties/api/propertyApi";
import PropertyBreadcrumbs from "./PropertyBreadcrumbs";
import "./property.css";

export const roomStatuses = {
    VACANT: {label: "Phòng trống", tone: "teal"},
    UPCOMING_VACANT: {label: "Sắp trống", tone: "amber"},
    OCCUPIED: {label: "Đang thuê", tone: "sky"},
    MAINTENANCE: {label: "Bảo trì", tone: "coral"},
} as const;

export default function BuildingRoomsPage() {
    const {buildingId} = useParams();
    const [building, setBuilding] = useState<Building | null>(null);
    const [result, setResult] = useState<Page<Room> | null>(null);
    const [page, setPage] = useState(0);
    const [sort, setSort] = useState("roomCode,asc");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const [creating, setCreating] = useState(false);
    const [types, setTypes] = useState<RoomType[]>([]);
    const [form, setForm] = useState<RoomInput>({
        buildingId: buildingId ?? "",
        roomTypeId: "",
        roomCode: "",
        maxCapacity: 1,
        area: 1,
        bedroomCount: 0,
        bathroomCount: 1,
        basePrice: 0,
        status: "VACANT"
    });
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const openCreate = async () => {
        setCreating(true);
        setFormError("");
        try {
            const list = await propertyApi.roomTypes();
            setTypes(list.content);
        } catch (cause) {
            setFormError(cause instanceof Error ? cause.message : "Không tải được loại phòng.");
        }
    };
    const create = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setFormError("");
        try {
            await propertyApi.createRoom({...form, buildingId: buildingId!});
            setCreating(false);
            setReload((value) => value + 1);
        } catch (cause) {
            setFormError(cause instanceof Error ? cause.message : "Không tạo được phòng.");
        } finally {
            setSaving(false);
        }
    };
    useEffect(() => {
        if (!buildingId) return;
        const controller = new AbortController();
        setLoading(true);
        setError("");
        Promise.all([propertyApi.building(buildingId, controller.signal), propertyApi.rooms(buildingId, page, sort, controller.signal)]).then(([b, r]) => {
            setBuilding(b);
            setResult(r);
        }).catch((cause) => {
            if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu.");
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [buildingId, page, sort, reload]);
    const rooms = useMemo(() => result?.content.filter((room) => room.roomCode.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")) && (!status || room.status === status)) ?? [], [result, search, status]);
    if (!buildingId) return <Navigate to="/admin/buildings" replace/>;
    return <>
        <PropertyBreadcrumbs building={building}/>
        <PageHead eyebrow="" title={building?.name ?? (loading ? "Đang tải tòa nhà…" : "Tòa nhà")}
                  desc={building?.address ?? "Danh sách phòng thuộc tòa nhà."}
                  actions={<><Link className="secondary-button" to="/admin/buildings">Quay lại danh sách tòa nhà</Link>
                      <button className="primary-button" onClick={openCreate}><Icon name="plus" size={16}/> Thêm phòng
                      </button>
                  </>}/>
        {error && <div className="panel property-state" role="alert"><p>{error}</p>
            <button className="secondary-button" onClick={() => setReload((value) => value + 1)}>Thử lại</button>
        </div>}
        {!error && loading && <div className="panel property-state" role="status">Đang tải danh sách phòng…</div>}
        {!error && !loading && result && <>
            <div className="property-summary">
                <div className="panel p-5">
                    <div className="text-sm text-muted">Tổng phòng</div>
                    <strong className="text-2xl">{result.totalElements}</strong></div>
            </div>
            <section className="panel">
                <div className="property-toolbar"><label className="field-search"><Icon name="search" size={16}/><input
                    aria-label="Tìm mã phòng trong trang hiện tại" placeholder="Tìm mã phòng trên trang này"
                    value={search} onChange={(event) => setSearch(event.target.value)}/></label><select
                    className="select" aria-label="Lọc trạng thái trong trang hiện tại" value={status}
                    onChange={(event) => setStatus(event.target.value)}>
                    <option value="">Mọi trạng thái</option>
                    {Object.entries(roomStatuses).map(([value, item]) => <option key={value}
                                                                                 value={value}>{item.label}</option>)}
                </select><select className="select" aria-label="Sắp xếp phòng" value={sort} onChange={(event) => {
                    setSort(event.target.value);
                    setPage(0);
                }}>
                    <option value="roomCode,asc">Mã phòng A–Z</option>
                    <option value="roomCode,desc">Mã phòng Z–A</option>
                    <option value="basePrice,asc">Giá tăng dần</option>
                    <option value="basePrice,desc">Giá giảm dần</option>
                </select>{(search || status) && <button className="secondary-button" onClick={() => {
                    setSearch("");
                    setStatus("");
                }}>Xóa bộ lọc</button>}</div>
                {rooms.length === 0 ? <div
                        className="property-state">{result.totalElements === 0 ? "Tòa nhà chưa có phòng." : "Không có phòng phù hợp trên trang này."}</div> :
                    <div className="property-table-wrap">
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th>Phòng</th>
                                <th>Diện tích</th>
                                <th>Giá cơ bản</th>
                                <th>Sức chứa</th>
                                <th>Trạng thái</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>{rooms.map((room) => <tr key={room.id}>
                                <td><Link className="property-link"
                                          to={`/admin/buildings/${buildingId}/rooms/${room.id}`}>Phòng {room.roomCode}</Link>
                                </td>
                                <td>{room.area} m²</td>
                                <td>{vnd(room.basePrice)}</td>
                                <td>{room.maxCapacity} người</td>
                                <td><Pill
                                    tone={roomStatuses[room.status]?.tone ?? "slate"}>{roomStatuses[room.status]?.label ?? room.status}</Pill>
                                </td>
                                <td><Link to={`/admin/buildings/${buildingId}/rooms/${room.id}`}>Xem chi tiết</Link>
                                </td>
                            </tr>)}</tbody>
                        </table>
                    </div>}
                {result.totalPages > 1 && <div className="property-pagination">
                    <span>Trang {page + 1}/{result.totalPages} · {result.totalElements} phòng</span>
                    <button className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước
                    </button>
                    <button className="secondary-button" disabled={result.last} onClick={() => setPage(page + 1)}>Sau
                    </button>
                </div>}
            </section>
            <p className="property-note">Tìm kiếm và lọc trạng thái áp dụng cho trang đang xem vì API phòng chưa hỗ trợ
                lọc trên toàn bộ danh sách.</p></>}
        <Drawer open={creating} title="Thêm phòng" onClose={() => setCreating(false)} footer={<>
            <button className="secondary-button" onClick={() => setCreating(false)}>Hủy</button>
            <button className="primary-button" form="room-form"
                    disabled={saving || !types.length}>{saving ? "Đang lưu…" : "Tạo phòng"}</button>
        </>}>
            <form id="room-form" onSubmit={create} className="property-form"><Field label="Mã phòng"><input required
                                                                                                            maxLength={50}
                                                                                                            value={form.roomCode}
                                                                                                            onChange={(event) => setForm({
                                                                                                                ...form,
                                                                                                                roomCode: event.target.value
                                                                                                            })}/></Field><Field
                label="Loại phòng"><select required value={form.roomTypeId}
                                           onChange={(event) => setForm({...form, roomTypeId: event.target.value})}>
                <option value="">Chọn loại phòng</option>
                {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field><Field
                label="Sức chứa"><input required type="number" min={1} value={form.maxCapacity}
                                        onChange={(event) => setForm({
                                            ...form,
                                            maxCapacity: Number(event.target.value)
                                        })}/></Field><Field label="Diện tích (m²)"><input required type="number"
                                                                                          min={0.01} step="any"
                                                                                          value={form.area}
                                                                                          onChange={(event) => setForm({
                                                                                              ...form,
                                                                                              area: Number(event.target.value)
                                                                                          })}/></Field><Field
                label="Số phòng ngủ"><input required type="number" min={0} value={form.bedroomCount}
                                            onChange={(event) => setForm({
                                                ...form,
                                                bedroomCount: Number(event.target.value)
                                            })}/></Field><Field label="Số phòng tắm"><input required type="number"
                                                                                            min={0}
                                                                                            value={form.bathroomCount}
                                                                                            onChange={(event) => setForm({
                                                                                                ...form,
                                                                                                bathroomCount: Number(event.target.value)
                                                                                            })}/></Field><Field
                label="Giá cơ bản (₫)"><input required type="number" min={0} value={form.basePrice}
                                              onChange={(event) => setForm({
                                                  ...form,
                                                  basePrice: Number(event.target.value)
                                              })}/></Field><Field label="Trạng thái"><select value={form.status}
                                                                                             onChange={(event) => setForm({
                                                                                                 ...form,
                                                                                                 status: event.target.value as Room["status"]
                                                                                             })}>{Object.entries(roomStatuses).map(([value, item]) =>
                <option key={value} value={value}>{item.label}</option>)}</select></Field>{formError &&
                <p role="alert" className="field-error">{formError}</p>}</form>
        </Drawer>
    </>;
}
