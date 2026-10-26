import { usePropertyConfirm } from "./usePropertyConfirm";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Field, Icon } from "@/shared/ui";
import { propertyApi, type BuildingInput, type BuildingStatus, type Province, type Ward } from "@/features/properties/api/propertyApi";
import { isValidPoint, searchPlaces, type MapPoint, type PlaceResult } from "@/features/properties/api/geocodingApi";
import BuildingLocationMap from "./BuildingLocationMap";
import BuildingImagesSection, { type PendingBuildingImage } from "./BuildingImagesSection";
import PropertyBreadcrumbs from "./PropertyBreadcrumbs";
import "./property.css";

type Draft = Pick<BuildingInput, "name" | "address" | "provinceId" | "wardId" | "description"> & { position: MapPoint | null; buildingStatus: BuildingStatus };
const emptyDraft: Draft = { name: "", address: "", provinceId: "", wardId: "", description: "", position: null, buildingStatus: "ACTIVE" };
type FieldErrors = Partial<Record<"name" | "address" | "provinceId" | "wardId" | "position", string>>;
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "Yêu cầu thất bại. Vui lòng thử lại.";

export default function BuildingFormPage() {
  const [confirmationPopup, confirm] = usePropertyConfirm();
  const { buildingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const imageUploadError = (location.state as { imageUploadError?: string } | null)?.imageUploadError;
  const editing = !!buildingId;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [initial, setInitial] = useState(JSON.stringify(emptyDraft));
  const [loaded, setLoaded] = useState(!editing);
  const [loadError, setLoadError] = useState("");
  const [loadKey, setLoadKey] = useState(0);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [wardsLoading, setWardsLoading] = useState(false);
  const [wardsError, setWardsError] = useState("");
  const [wardRetry, setWardRetry] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState(imageUploadError ?? "");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [pendingImages, setPendingImages] = useState<PendingBuildingImage[]>([]);
  const [imagesRefreshKey, setImagesRefreshKey] = useState(0);
  const [uploadProgress, setUploadProgress] = useState("");
  const [focusKey, setFocusKey] = useState(0);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);
  const searchController = useRef<AbortController | null>(null);
  const [suggestedAddress, setSuggestedAddress] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualError, setManualError] = useState("");
  const dirty = JSON.stringify(draft) !== initial || pendingImages.length > 0;

  useEffect(() => { if (imageUploadError) setSubmitError(imageUploadError); }, [imageUploadError]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(""); setLoaded(!editing);
    const requests: Promise<unknown>[] = [propertyApi.provinces(controller.signal).then(setProvinces)];
    if (buildingId) requests.push(propertyApi.building(buildingId, controller.signal).then((building) => {
      const point = { latitude: building.latitude, longitude: building.longitude };
      const next: Draft = { name: building.name, address: building.address, provinceId: building.provinceId, wardId: building.wardId, description: building.description, position: isValidPoint(point) ? point : null, buildingStatus: building.buildingStatus };
      setDraft(next); setInitial(JSON.stringify(next));
    }));
    Promise.all(requests).then(() => setLoaded(true)).catch((cause) => { if (!controller.signal.aborted) setLoadError(errorText(cause)); });
    return () => controller.abort();
  }, [buildingId, editing, loadKey]);

  useEffect(() => {
    if (!draft.provinceId) { setWards([]); setWardsError(""); return; }
    const controller = new AbortController(); setWardsLoading(true); setWardsError(""); setWards([]);
    propertyApi.wardsByProvince(draft.provinceId, controller.signal).then(setWards).catch((cause) => { if (!controller.signal.aborted) setWardsError(errorText(cause)); }).finally(() => { if (!controller.signal.aborted) setWardsLoading(false); });
    return () => controller.abort();
  }, [draft.provinceId, wardRetry]);

  useEffect(() => () => searchController.current?.abort(), []);
  const setPosition = (position: MapPoint) => {
    setDraft((current) => ({ ...current, position }));
    setFieldErrors((current) => ({ ...current, position: undefined }));
    setSuggestedAddress("");
  };
  const search = async (event: FormEvent) => {
    event.preventDefault();
    searchController.current?.abort();
    const controller = new AbortController(); searchController.current = controller;
    setSearching(true); setSearchError(""); setSearched(false); setPlaces([]);
    try { const matches = await searchPlaces(query, controller.signal); if (!controller.signal.aborted) { setPlaces(matches); setSearched(true); } }
    catch (cause) { if (!controller.signal.aborted) setSearchError(errorText(cause)); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  };
  const choosePlace = (place: PlaceResult) => {
    setDraft((current) => ({ ...current, position: { latitude: place.latitude, longitude: place.longitude } }));
    setFieldErrors((current) => ({ ...current, position: undefined }));
    setSuggestedAddress(place.label); setPlaces([]); setFocusKey((value) => value + 1);
  };
  const applyManualPosition = (event: FormEvent) => {
    event.preventDefault();
    const point = { latitude: Number(manualLat), longitude: Number(manualLng) };
    if (!manualLat.trim() || !manualLng.trim() || !isValidPoint(point)) { setManualError("Nhập vĩ độ từ -90 đến 90 và kinh độ từ -180 đến 180."); return; }
    setPosition(point); setFocusKey((value) => value + 1); setManualOpen(false); setManualError("");
  };
  const cancel = async () => { if (!dirty || await confirm({ title: "Rời trang khi chưa lưu?", message: "Bạn có thay đổi chưa lưu. Rời trang này?", confirmLabel: "Rời trang" })) navigate("/admin/buildings"); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    const errors: FieldErrors = {};
    if (!draft.name.trim()) errors.name = "Nhập tên tòa nhà.";
    if (!draft.address.trim()) errors.address = "Nhập địa chỉ tòa nhà.";
    if (!draft.provinceId) errors.provinceId = "Chọn tỉnh/thành phố.";
    if (!draft.wardId || !wards.some((ward) => ward.wardId === draft.wardId)) errors.wardId = "Chọn phường/xã thuộc tỉnh đã chọn.";
    if (!isValidPoint(draft.position)) errors.position = "Chọn vị trí hợp lệ trên bản đồ.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    savingRef.current = true; setSaving(true); setSubmitError(""); setUploadProgress("");
    let savedBuildingId = buildingId;
    try {
      const position = draft.position!;
      if (!buildingId || JSON.stringify(draft) !== initial) {
        const saved = await propertyApi.saveBuilding({ name: draft.name.trim(), address: draft.address.trim(), provinceId: draft.provinceId, wardId: draft.wardId, description: draft.description, latitude: position.latitude, longitude: position.longitude, ...(buildingId ? { buildingStatus: draft.buildingStatus } : {}) }, buildingId);
        savedBuildingId = saved.buildingId;
      }
      for (let index = 0; index < pendingImages.length; index++) {
        const item = pendingImages[index];
        setUploadProgress(`Đang tải ảnh ${index + 1}/${pendingImages.length}: ${item.file.name}`);
        await propertyApi.uploadBuildingImage(savedBuildingId!, item.file);
        setPendingImages((current) => current.filter((candidate) => candidate.id !== item.id));
        setImagesRefreshKey((value) => value + 1);
      }
      navigate("/admin/buildings", { replace: true, state: { propertyNotice: editing ? "Đã cập nhật tòa nhà." : "Đã thêm tòa nhà." } });
    } catch (cause) {
      if (!buildingId && savedBuildingId) {
        navigate(`/admin/buildings/${encodeURIComponent(savedBuildingId)}/edit`, { replace: true, state: { imageUploadError: `Đã tạo tòa nhà nhưng một số ảnh chưa tải lên: ${errorText(cause)}. Kiểm tra ảnh còn thiếu rồi lưu lại.` } });
      } else setSubmitError(errorText(cause));
    } finally { savingRef.current = false; setSaving(false); setUploadProgress(""); }
  };

  return <>
    {confirmationPopup}
    <PropertyBreadcrumbs action={editing ? "Sửa tòa nhà" : "Thêm tòa nhà"}/>
    <header className="building-page-head"><div><h1 className="page-title">{editing ? "Sửa tòa nhà" : "Thêm tòa nhà"}</h1><p>Nhập thông tin và xác định vị trí trên bản đồ.</p></div></header>
    {loadError && <div className="panel property-state" role="alert"><p>{loadError}</p><button className="secondary-button" onClick={() => setLoadKey((value) => value + 1)}>Thử lại</button></div>}
    {!loadError && !loaded && <div className="panel property-state" role="status">Đang tải thông tin tòa nhà…</div>}
    {!loadError && loaded && <>
      <div className="building-editor-grid">
        <div className="building-editor-left">
        <section className="panel building-editor-info"><h2>Thông tin tòa nhà</h2><p className="building-editor-intro">Các trường có dấu * là bắt buộc.</p>
          <form id="building-editor-form" onSubmit={save} noValidate className="property-form">
            <Field label="Tên tòa nhà *" error={fieldErrors.name}><input aria-required="true" maxLength={200} value={draft.name} onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setFieldErrors((current) => ({ ...current, name: undefined })); }}/></Field>
            <Field label="Địa chỉ *" error={fieldErrors.address}><input aria-required="true" maxLength={500} value={draft.address} onChange={(event) => { setDraft({ ...draft, address: event.target.value }); setFieldErrors((current) => ({ ...current, address: undefined })); }}/></Field>
            <Field label="Tỉnh/thành phố *" error={fieldErrors.provinceId}><select aria-required="true" value={draft.provinceId} onChange={(event) => { setDraft({ ...draft, provinceId: event.target.value, wardId: "" }); setFieldErrors((current) => ({ ...current, provinceId: undefined, wardId: undefined })); }}><option value="">Chọn tỉnh/thành phố</option>{provinces.map((item) => <option key={item.provinceId} value={item.provinceId}>{item.name}</option>)}</select></Field>
            <Field label="Phường/xã *" error={fieldErrors.wardId}><select aria-required="true" value={draft.wardId} disabled={!draft.provinceId || wardsLoading} onChange={(event) => { setDraft({ ...draft, wardId: event.target.value }); setFieldErrors((current) => ({ ...current, wardId: undefined })); }}><option value="">{wardsLoading ? "Đang tải phường/xã…" : "Chọn phường/xã"}</option>{wards.map((item) => <option key={item.wardId} value={item.wardId}>{item.name}</option>)}</select></Field>
            {wardsError && <div className="property-location-error" role="alert"><span>{wardsError}</span><button type="button" className="secondary-button" onClick={() => setWardRetry((value) => value + 1)}>Thử tải lại</button></div>}
            <Field label="Mô tả"><textarea value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></Field>
            {editing && <Field label="Trạng thái tòa nhà"><select value={draft.buildingStatus} onChange={(event) => setDraft({ ...draft, buildingStatus: event.target.value as BuildingStatus })}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Tạm ngừng</option><option value="MAINTENANCE">Đang bảo trì</option><option value="CLOSED">Đã đóng</option></select></Field>}
          </form>
        </section>
        <BuildingImagesSection buildingId={buildingId} pending={pendingImages} onPendingChange={setPendingImages} refreshKey={imagesRefreshKey} disabled={saving} uploadProgress={uploadProgress}/>
        </div>
        <section className="panel building-editor-map-panel"><h2>Vị trí tòa nhà</h2><p className="building-editor-intro">Tìm địa điểm, nhấp trên bản đồ hoặc kéo ghim để xác nhận vị trí.</p>
          <form className="building-map-search" onSubmit={search}><label className="field-search"><Icon name="search" size={17}/><input aria-label="Tìm địa chỉ hoặc địa điểm" placeholder="Tìm địa chỉ hoặc địa điểm..." value={query} onChange={(event) => setQuery(event.target.value)}/></label><button type="submit" className="secondary-button" disabled={searching}>{searching ? "Đang tìm…" : "Tìm kiếm"}</button></form>
          {searchError && <p className="building-map-message building-map-message-error" role="alert">{searchError}</p>}
          {searched && places.length === 0 && <p className="building-map-message">Không tìm thấy địa điểm phù hợp.</p>}
          {places.length > 0 && <div className="building-search-results" aria-label="Kết quả tìm địa điểm">{places.map((place) => <button type="button" key={place.id} onClick={() => choosePlace(place)}><Icon name="pin" size={16}/><span>{place.label}</span></button>)}</div>}
          <BuildingLocationMap position={draft.position} focusKey={focusKey} onSelect={setPosition}/>
          {fieldErrors.position && <p className="building-map-message building-map-message-error" role="alert">{fieldErrors.position}</p>}
          {suggestedAddress && <div className="building-address-suggestion"><div><b>Địa chỉ gợi ý</b><p>{suggestedAddress}</p></div><button type="button" className="secondary-button" onClick={() => { setDraft((current) => ({ ...current, address: suggestedAddress })); setSuggestedAddress(""); }}>Dùng địa chỉ này</button></div>}
          <p className="building-map-guidance">{draft.position ? "Đã chọn vị trí. Kiểm tra địa chỉ và tỉnh/phường có khớp với ghim trên bản đồ." : "Chưa chọn vị trí. Nhấp vào bản đồ hoặc tìm địa điểm để đặt ghim."}</p>
          <div className="building-coordinates"><div><span>Vĩ độ</span><strong>{draft.position ? draft.position.latitude.toFixed(6) : "Chưa chọn"}</strong></div><div><span>Kinh độ</span><strong>{draft.position ? draft.position.longitude.toFixed(6) : "Chưa chọn"}</strong></div><button type="button" className="building-manual-toggle" onClick={() => { setManualOpen(!manualOpen); setManualLat(draft.position ? String(draft.position.latitude) : ""); setManualLng(draft.position ? String(draft.position.longitude) : ""); setManualError(""); }}>{manualOpen ? "Ẩn nhập tọa độ" : "Nhập tọa độ thủ công"}</button></div>
          {manualOpen && <form className="building-manual-form" onSubmit={applyManualPosition} noValidate><label>Vĩ độ<input type="number" min={-90} max={90} step="any" value={manualLat} onChange={(event) => setManualLat(event.target.value)}/></label><label>Kinh độ<input type="number" min={-180} max={180} step="any" value={manualLng} onChange={(event) => setManualLng(event.target.value)}/></label><button type="submit" className="secondary-button">Áp dụng tọa độ</button>{manualError && <p role="alert" className="field-error">{manualError}</p>}</form>}
        </section>
      </div>
      {submitError && <div className="building-feedback building-feedback-error" role="alert"><Icon name="bell" size={17}/>{submitError}</div>}
      <div className="building-editor-actions"><button type="button" className="secondary-button" onClick={cancel} disabled={saving}>Hủy</button><button type="submit" form="building-editor-form" className="primary-button" disabled={saving}>{saving ? "Đang lưu…" : "Lưu tòa nhà"}</button></div>
    </>}
  </>;
}
