import {useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router";
import {Icon} from "@/shared/ui";
import {
    propertyApi,
    type Building,
    type BuildingSearchResult,
    type Page,
    type Province,
    type Ward
} from "@/features/properties/api/propertyApi";
import PropertyBreadcrumbs from "./PropertyBreadcrumbs";
import BuildingList from "./BuildingList";
import "./property.css";

const message = (error: unknown) => error instanceof Error ? error.message : "Không tải được dữ liệu. Vui lòng thử lại.";

export default function BuildingManagement() {
    const navigate = useNavigate();
    const location = useLocation();
    const [search, setSearch] = useState("");
    const [keyword, setKeyword] = useState("");
    const [provinceId, setProvinceId] = useState("");
    const [wardId, setWardId] = useState("");
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [filterWards, setFilterWards] = useState<Ward[]>([]);
    const [locationsError, setLocationsError] = useState("");
    const [locationsReload, setLocationsReload] = useState(0);
    const [filterWardsLoading, setFilterWardsLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(20);
    const [result, setResult] = useState<Page<BuildingSearchResult> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        const notice = (location.state as { propertyNotice?: string } | null)?.propertyNotice;
        if (!notice) return;
        setFeedback({tone: "success", text: notice});
        navigate(location.pathname, {replace: true, state: null});
    }, [location.pathname, location.state, navigate]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setKeyword(search.trim());
            setPage(0);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);
    useEffect(() => {
        const controller = new AbortController();
        setLocationsError("");
        propertyApi.provinces(controller.signal).then(setProvinces).catch((cause) => {
            if (!controller.signal.aborted) setLocationsError(message(cause));
        });
        return () => controller.abort();
    }, [locationsReload]);
    useEffect(() => {
        if (!provinceId) {
            setFilterWards([]);
            setFilterWardsLoading(false);
            return;
        }
        const controller = new AbortController();
        setFilterWards([]);
        setFilterWardsLoading(true);
        setLocationsError("");
        propertyApi.wardsByProvince(provinceId, controller.signal).then(setFilterWards).catch((cause) => {
            if (!controller.signal.aborted) setLocationsError(message(cause));
        }).finally(() => {
            if (!controller.signal.aborted) setFilterWardsLoading(false);
        });
        return () => controller.abort();
    }, [provinceId, locationsReload]);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");
        propertyApi.buildings(page, size, keyword, provinceId, wardId, controller.signal).then(setResult).catch((cause) => {
            if (!controller.signal.aborted) setError(message(cause));
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [page, size, keyword, provinceId, wardId, reload]);

    const openForm = (building?: Building) => navigate(building ? `/admin/buildings/${encodeURIComponent(building.buildingId)}/edit` : "/admin/buildings/new");
    const remove = async (building: Building) => {
        if (!window.confirm(`Xóa tòa nhà “${building.name}”?`)) return;
        setDeletingId(building.buildingId);
        setFeedback(null);
        try {
            await propertyApi.deleteBuilding(building.buildingId);
            setFeedback({tone: "success", text: `Đã xóa tòa nhà “${building.name}”.`});
            if (result?.content.length === 1 && page > 0) setPage(page - 1);
            else setReload((value) => value + 1);
        } catch (cause) {
            setFeedback({tone: "error", text: message(cause)});
        } finally {
            setDeletingId(null);
        }
    };
    return <>
        <PropertyBreadcrumbs/>
        <header className="building-page-head">
            <div><h1 className="page-title">Tòa nhà</h1><p>Quản lý danh sách tòa nhà, vị trí và tình trạng khai thác.</p></div>
            <button className="primary-button" onClick={() => openForm()}><Icon name="plus" size={16}/> Thêm tòa nhà</button>
        </header>
        <section className="building-summary panel" aria-label="Thống kê tòa nhà">
            <div className="building-summary-mark"><Icon name="building" size={20}/></div>
            <div><span>{keyword || provinceId || wardId ? "Tòa nhà phù hợp" : "Tổng tòa nhà"}</span><strong>{loading || error || !result ? "—" : result.totalElements.toLocaleString("vi-VN")}</strong></div>
            <p>Số lượng theo bộ lọc hiện tại</p>
        </section>
        {feedback && <div className={`building-feedback building-feedback-${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}><Icon name={feedback.tone === "success" ? "check" : "bell"} size={17}/><span>{feedback.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setFeedback(null)}><Icon name="close" size={15}/></button></div>}
        <section className="panel building-list-panel" aria-label="Danh sách tòa nhà">
            <div className="property-toolbar">
                <label className="field-search"><Icon name="search" size={16}/><input
                    aria-label="Tìm theo tên hoặc địa chỉ" placeholder="Tìm theo tên hoặc địa chỉ" value={search}
                    onChange={(event) => setSearch(event.target.value)}/></label>
                <select className="select" aria-label="Lọc theo tỉnh thành" value={provinceId} onChange={(event) => {
                    setProvinceId(event.target.value);
                    setWardId("");
                    setPage(0);
                }}>
                    <option value="">Tất cả tỉnh/thành</option>
                    {provinces.map((province) => <option key={province.provinceId}
                                                         value={province.provinceId}>{province.name}</option>)}</select>
                <select className="select" aria-label="Lọc theo phường xã" value={wardId}
                        disabled={!provinceId || filterWardsLoading} onChange={(event) => {
                    setWardId(event.target.value);
                    setPage(0);
                }}>
                    <option value="">{filterWardsLoading ? "Đang tải phường/xã…" : "Tất cả phường/xã"}</option>
                    {filterWards.map((ward) => <option key={ward.wardId} value={ward.wardId}>{ward.name}</option>)}
                </select>
                {(search || provinceId || wardId) && <button className="secondary-button" onClick={() => {
                    setSearch("");
                    setProvinceId("");
                    setWardId("");
                    setPage(0);
                }}>Xóa bộ lọc</button>}
            </div>
            {locationsError && <div className="property-location-error" role="alert"><span>Không tải được danh mục tỉnh/phường: {locationsError}</span><button className="secondary-button" onClick={() => setLocationsReload((value) => value + 1)}>Thử tải lại</button></div>}
            {error && <div className="property-state" role="alert"><Icon name="bell" size={24}/><h2>Không tải được danh sách tòa nhà</h2><p>{error}</p><button className="secondary-button" onClick={() => setReload((value) => value + 1)}>Thử lại</button></div>}
            {!error && loading && <div className="building-loading" role="status" aria-label="Đang tải danh sách tòa nhà">{Array.from({length: 4}, (_, index) => <div className="building-skeleton-row" key={index}><span/><i/><i/><i/></div>)}</div>}
            {!error && !loading && result?.content.length === 0 && <div className="property-state"><Icon name="building" size={28}/><h2>{keyword || provinceId || wardId ? "Không tìm thấy tòa nhà phù hợp" : "Chưa có tòa nhà nào"}</h2><p>{keyword || provinceId || wardId ? "Hãy thử từ khóa hoặc khu vực khác." : "Thêm tòa nhà đầu tiên để bắt đầu quản lý."}</p>{!(keyword || provinceId || wardId) && <button className="primary-button" onClick={() => openForm()}><Icon name="plus" size={16}/> Thêm tòa nhà</button>}</div>}
            {!error && !loading && !!result?.content.length && <BuildingList buildings={result.content} deletingId={deletingId} onEdit={openForm} onDelete={remove}/>}
            {!error && !loading && result && result.totalElements > 0 && <div className="property-pagination">
                <span>Hiển thị {result.number * result.size + 1}–{Math.min((result.number + 1) * result.size, result.totalElements)} / {result.totalElements} tòa nhà</span>
                <label className="building-page-size">Mỗi trang <select className="select" aria-label="Số tòa nhà mỗi trang" value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
                <div className="building-page-controls"><button className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Trang trước">Trước</button><span>Trang {result.number + 1}/{result.totalPages}</span><button className="secondary-button" disabled={page >= result.totalPages - 1} onClick={() => setPage(page + 1)} aria-label="Trang sau">Sau</button></div>
            </div>}
        </section>
    </>;
}
