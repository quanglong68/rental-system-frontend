import { useEffect, useState, type ChangeEvent } from "react";
import { propertyApi, type BuildingImage } from "@/features/properties/api/propertyApi";
import { Icon } from "@/shared/ui";

export type PendingBuildingImage = { id: string; file: File };

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileSize = 5 * 1024 * 1024;
let nextFileId = 0;
const message = (cause: unknown) => cause instanceof Error ? cause.message : "Không tải được ảnh. Vui lòng thử lại.";

function PendingPreview({ item }: { item: PendingBuildingImage }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const preview = URL.createObjectURL(item.file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [item.file]);
  return url ? <img src={url} alt={`Ảnh chờ tải lên: ${item.file.name}`} /> : <Icon name="building" size={24} />;
}

export default function BuildingImagesSection({ buildingId, pending, onPendingChange, refreshKey, disabled, uploadProgress }: {
  buildingId?: string;
  pending: PendingBuildingImage[];
  onPendingChange: (items: PendingBuildingImage[]) => void;
  refreshKey: number;
  disabled: boolean;
  uploadProgress: string;
}) {
  const [images, setImages] = useState<BuildingImage[]>([]);
  const [loading, setLoading] = useState(!!buildingId);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selectionError, setSelectionError] = useState("");

  useEffect(() => {
    if (!buildingId) return;
    const controller = new AbortController();
    setLoading(true); setLoadError("");
    propertyApi.buildingImages(buildingId, controller.signal)
      .then((items) => setImages([...items].sort((a, b) => a.displayOrder - b.displayOrder)))
      .catch((cause) => { if (!controller.signal.aborted) setLoadError(message(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [buildingId, refreshKey, retry]);

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    const valid: PendingBuildingImage[] = [];
    const rejected: string[] = [];
    for (const file of selected) {
      if (!allowedTypes.has(file.type)) rejected.push(`${file.name}: chỉ hỗ trợ JPEG, PNG hoặc WebP.`);
      else if (!file.size || file.size > maxFileSize) rejected.push(`${file.name}: ảnh phải lớn hơn 0 và không quá 5 MiB.`);
      else valid.push({ id: String(++nextFileId), file });
    }
    if (valid.length) onPendingChange([...pending, ...valid]);
    setSelectionError(rejected.join(" "));
  };

  return <section className="panel building-images-panel" aria-labelledby="building-images-title">
    <div className="building-images-head"><div><h2 id="building-images-title">Ảnh tòa nhà</h2><p>JPEG, PNG hoặc WebP; tối đa 5 MiB mỗi ảnh. Nếu chưa có ảnh, ảnh đầu tiên sẽ là ảnh đại diện.</p></div><label className={`secondary-button building-image-picker${disabled ? " is-disabled" : ""}`}><Icon name="plus" size={16}/> Chọn ảnh<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectFiles} disabled={disabled} aria-label="Chọn ảnh tòa nhà" /></label></div>
    {selectionError && <p className="building-image-error" role="alert">{selectionError}</p>}
    {loadError && <div className="property-location-error" role="alert"><span>Không tải được ảnh đã lưu: {loadError}</span><button type="button" className="secondary-button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></div>}
    {loading && <p className="building-image-status" role="status">Đang tải ảnh đã lưu…</p>}
    {!loading && !loadError && images.length > 0 && <div className="building-image-gallery">{images.map((image) => <figure key={image.imageId}><img src={image.imageUrl} alt={`Ảnh tòa nhà ${image.displayOrder + 1}`} loading="lazy"/><figcaption>{image.primaryImage ? "Ảnh đại diện" : `Ảnh ${image.displayOrder + 1}`}</figcaption></figure>)}</div>}
    {!loading && !loadError && images.length === 0 && buildingId && <p className="building-image-status">Tòa nhà chưa có ảnh.</p>}
    {pending.length > 0 && <><h3>Ảnh chờ tải lên ({pending.length})</h3><div className="building-image-gallery">{pending.map((item) => <figure key={item.id}><PendingPreview item={item}/><figcaption title={item.file.name}>{item.file.name}</figcaption><button type="button" aria-label={`Bỏ ảnh ${item.file.name}`} disabled={disabled} onClick={() => onPendingChange(pending.filter((candidate) => candidate.id !== item.id))}><Icon name="close" size={15}/></button></figure>)}</div><p className="building-image-status">Ảnh sẽ được tải lên khi bạn lưu tòa nhà.</p></>}
    {uploadProgress && <p className="building-image-status" role="status">{uploadProgress}</p>}
  </section>;
}
