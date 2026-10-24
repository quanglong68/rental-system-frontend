import {useEffect, useState, type FormEvent} from "react";
import {Link, useNavigate} from "react-router";
import {Drawer, Field, Icon, PageHead} from "@/shared/ui";
import {
    propertyApi,
    type Building,
    type BuildingInput,
    type Page,
    type Province,
    type Ward
} from "@/features/properties/api/propertyApi";
import PropertyBreadcrumbs from "./PropertyBreadcrumbs";
import "./property.css";

const blank: BuildingInput = {
    name: "",
    address: "",
    wardId: "",
    provinceId: "",
    latitude: 0,
    longitude: 0,
    description: ""
};
const message = (error: unknown) => error instanceof Error ? error.message : "Không tải được dữ liệu. Vui lòng thử lại.";

export default function BuildingManagement() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [keyword, setKeyword] = useState("");
    const [provinceId, setProvinceId] = useState("");
    const [wardId, setWardId] = useState("");
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [filterWards, setFilterWards] = useState<Ward[]>([]);
    const [formWards, setFormWards] = useState<Ward[]>([]);
    const [locationsError, setLocationsError] = useState("");
    const [locationsReload, setLocationsReload] = useState(0);
    const [formWardsError, setFormWardsError] = useState("");
    const [formWardsReload, setFormWardsReload] = useState(0);
    const [filterWardsLoading, setFilterWardsLoading] = useState(false);
    const [formWardsLoading, setFormWardsLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [result, setResult] = useState<Page<Building> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const [editing, setEditing] = useState<Building | "new" | null>(null);
    const [form, setForm] = useState<BuildingInput>(blank);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

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
        if (!editing || !form.provinceId) {
            setFormWards([]);
            setFormWardsLoading(false);
            return;
        }
        const controller = new AbortController();
        setFormWards([]);
        setFormWardsLoading(true);
        setFormWardsError("");
        propertyApi.wardsByProvince(form.provinceId, controller.signal).then(setFormWards).catch((cause) => {
            if (!controller.signal.aborted) setFormWardsError(message(cause));
        }).finally(() => {
            if (!controller.signal.aborted) setFormWardsLoading(false);
        });
        return () => controller.abort();
    }, [editing, form.provinceId, formWardsReload]);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");
        propertyApi.buildings(page, keyword, provinceId, wardId, controller.signal).then(setResult).catch((cause) => {
            if (!controller.signal.aborted) setError(message(cause));
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [page, keyword, provinceId, wardId, reload]);

    const openForm = (building?: Building) => {
        setEditing(building ?? "new");
        setForm(building ? {
            name: building.name,
            address: building.address,
            wardId: building.wardId,
            provinceId: building.provinceId,
            latitude: building.latitude,
            longitude: building.longitude,
            description: building.description
        } : blank);
        setFormError("");
    };
    const save = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setFormError("");
        try {
            await propertyApi.saveBuilding(form, editing && editing !== "new" ? editing.buildingId : undefined);
            setEditing(null);
            setReload((value) => value + 1);
        } catch (cause) {
            setFormError(message(cause));
        } finally {
            setSaving(false);
        }
    };
    const remove = async (building: Building) => {
        if (!window.confirm(`Xóa tòa nhà “${building.name}”?`)) return;
        try {
            await propertyApi.deleteBuilding(building.buildingId);
            setReload((value) => value + 1);
        } catch (cause) {
            setError(message(cause));
        }
    };
    return <>
        <PropertyBreadcrumbs/>
        <PageHead eyebrow="" title="Tòa nhà" desc="Quản lý danh sách tòa nhà, vị trí và tình trạng khai thác."
                  actions={<button className="primary-button" onClick={() => openForm()}><Icon name="plus"
                                                                                               size={16}/> Thêm tòa nhà
                  </button>}/>
        <div className="property-summary">
            <div className="panel p-5">
                <div className="text-sm text-muted">Tổng tòa nhà</div>
                <strong className="text-2xl">{result?.totalElements ?? "—"}</strong></div>
        </div>
        <section className="panel">
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
            {error && <div className="property-state" role="alert"><p>{error}</p>
                <button className="secondary-button" onClick={() => setReload((value) => value + 1)}>Thử lại</button>
            </div>}
            {!error && loading && <div className="property-state" role="status">Đang tải danh sách tòa nhà…</div>}
            {!error && !loading && result?.content.length === 0 && <div
                className="property-state">{keyword || provinceId || wardId ? "Không tìm thấy tòa nhà phù hợp." : "Chưa có tòa nhà nào."}</div>}
            {!error && !loading && !!result?.content.length && <div className="property-table-wrap">
                <table className="data-table">
                    <thead>
                    <tr>
                        <th>Tòa nhà</th>
                        <th>Địa chỉ</th>
                        <th>Địa bàn</th>
                        <th>Thao tác</th>
                    </tr>
                    </thead>
                    <tbody>{result.content.map((building) => <tr key={building.buildingId}
                                                                 onClick={() => navigate(`/admin/buildings/${building.buildingId}/rooms`)}>
                        <td><Link className="property-link"
                                  to={`/admin/buildings/${building.buildingId}/rooms`}>{building.name}</Link></td>
                        <td>{building.address}</td>
                        <td>{[building.wardName, building.provinceName].filter(Boolean).join(", ") || "—"}</td>
                        <td>
                            <div className="property-actions" onClick={(event) => event.stopPropagation()}><Link
                                to={`/admin/buildings/${building.buildingId}/rooms`}>Xem phòng</Link>
                                <button onClick={() => openForm(building)}>Sửa</button>
                                <button className="property-danger" onClick={() => remove(building)}>Xóa</button>
                            </div>
                        </td>
                    </tr>)}</tbody>
                </table>
            </div>}
            {!error && !loading && result && result.totalPages > 1 && <div className="property-pagination">
                <span>Trang {page + 1}/{result.totalPages} · {result.totalElements} tòa nhà</span>
                <button className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước
                </button>
                <button className="secondary-button" disabled={result.last} onClick={() => setPage(page + 1)}>Sau
                </button>
            </div>}
        </section>
        <Drawer open={editing !== null} title={editing === "new" ? "Thêm tòa nhà" : "Sửa tòa nhà"}
                onClose={() => setEditing(null)} footer={<>
            <button className="secondary-button" onClick={() => setEditing(null)}>Hủy</button>
            <button form="building-form" className="primary-button"
                    disabled={saving}>{saving ? "Đang lưu…" : "Lưu tòa nhà"}</button>
        </>}>
            <form id="building-form" onSubmit={save} className="property-form">
                <Field label="Tên tòa nhà"><input required maxLength={200} value={form.name}
                                                  onChange={(event) => setForm({
                                                      ...form,
                                                      name: event.target.value
                                                  })}/></Field>
                <Field label="Địa chỉ"><input required maxLength={500} value={form.address}
                                              onChange={(event) => setForm({
                                                  ...form,
                                                  address: event.target.value
                                              })}/></Field>
                <Field label="Tỉnh/thành phố"><select required value={form.provinceId} onChange={(event) => setForm({
                    ...form,
                    provinceId: event.target.value,
                    wardId: ""
                })}>
                    <option value="">Chọn tỉnh/thành phố</option>
                    {provinces.map((province) => <option key={province.provinceId}
                                                         value={province.provinceId}>{province.name}</option>)}</select></Field>
                <Field label="Phường/xã"><select required value={form.wardId}
                                                 disabled={!form.provinceId || formWardsLoading}
                                                 onChange={(event) => setForm({...form, wardId: event.target.value})}>
                    <option value="">{formWardsLoading ? "Đang tải phường/xã…" : "Chọn phường/xã"}</option>
                    {formWards.map((ward) => <option key={ward.wardId} value={ward.wardId}>{ward.name}</option>)}
                </select></Field>
                {formWardsError &&
                    <div className="property-location-error" role="alert"><span>Không tải được phường/xã: {formWardsError}</span><button type="button" className="secondary-button" onClick={() => setFormWardsReload((value) => value + 1)}>Thử tải lại</button></div>}
                <Field label="Vĩ độ"><input required type="number" step="any" min={-90} max={90} value={form.latitude}
                                            onChange={(event) => setForm({
                                                ...form,
                                                latitude: Number(event.target.value)
                                            })}/></Field>
                <Field label="Kinh độ"><input required type="number" step="any" min={-180} max={180}
                                              value={form.longitude} onChange={(event) => setForm({
                    ...form,
                    longitude: Number(event.target.value)
                })}/></Field>
                <Field label="Mô tả"><textarea value={form.description ?? ""} onChange={(event) => setForm({
                    ...form,
                    description: event.target.value
                })}/></Field>
                {formError && <p role="alert" className="field-error">{formError}</p>}
            </form>
        </Drawer>
    </>;
}
