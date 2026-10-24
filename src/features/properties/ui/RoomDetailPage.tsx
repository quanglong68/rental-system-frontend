import {useEffect, useState} from "react";
import {Link, Navigate, useParams} from "react-router";
import {PageHead, Pill, Tabs, vnd} from "@/shared/ui";
import {
    propertyApi,
    type Building,
    type OccupancySummary,
    type Occupant,
    type Page,
    type Room
} from "@/features/properties/api/propertyApi";
import PropertyBreadcrumbs from "./PropertyBreadcrumbs";
import {roomStatuses} from "./BuildingRoomsPage";
import "./property.css";

const tabs = ["Tổng quan", "Người cư trú", "Hợp đồng", "Lịch sử"];
export default function RoomDetailPage() {
    const {buildingId, roomId} = useParams();
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

    if (!buildingId || !roomId) return <Navigate to="/admin/buildings" replace/>;
    return <>
        <PropertyBreadcrumbs building={building} room={room}/>
        <PageHead eyebrow="" title={room ? `Phòng ${room.roomCode}` : "Chi tiết phòng"}
                  desc={building ? `${building.name} · ${building.address}` : "Đang tải thông tin tòa nhà…"}
                  actions={<Link className="secondary-button" to={`/admin/buildings/${buildingId}/rooms`}>Quay lại danh
                      sách phòng</Link>}/>
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
                <div><span className="text-sm text-muted">Giá cơ bản</span><strong>{vnd(room.basePrice)}</strong></div>
                <div><span className="text-sm text-muted">Diện tích</span><strong>{room.area} m²</strong></div>
                <div><span className="text-sm text-muted">Sức chứa</span><strong>{room.maxCapacity} người</strong></div>
            </div>
            <Tabs items={tabs} value={tab} onChange={(value) => {
                setTab(value);
                setPage(0);
                setOccupants(null);
            }}/>
            {tab === "Tổng quan" &&
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
                            <dd>{room.roomTypeId}</dd>
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
                </section>}
            {(tab === "Người cư trú" || tab === "Lịch sử") && <section className="panel">
                <div className="property-toolbar"><h2
                    className="text-lg font-bold">{tab === "Lịch sử" ? "Lịch sử cư trú" : "Người cư trú hiện tại"}</h2>{summary && tab === "Người cư trú" &&
                    <span className="text-sm text-muted">{summary.currentOccupants}/{summary.maxCapacity} người</span>}
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
    </>;
}
