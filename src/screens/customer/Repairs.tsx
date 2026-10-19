import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, toVNTime } from "../../components/ui";
import { assetApi, type MaintenanceReport } from "../../api/assetMaintenance";

const cats = [{ k: "Điện", e: "⚡" }, { k: "Nước", e: "💧" }, { k: "Máy lạnh", e: "❄️" }, { k: "Internet", e: "📶" }, { k: "Khóa cửa", e: "🔑" }, { k: "Khác", e: "✦" }];
const statusText: Record<string, string> = { PENDING: "Đã gửi", APPROVED: "Đã tiếp nhận", REJECTED: "Bị từ chối" };
const MAX = 5;

export default function Repairs() {
  const [list, setList] = useState<MaintenanceReport[]>([]); const [photos, setPhotos] = useState<File[]>([]); const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoErr, setPhotoErr] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null); const [roomId, setRoomId] = useState(""); const [cat, setCat] = useState("Điện"); const [text, setText] = useState("");
  const reload = () => assetApi.myReports().then(setList).catch((e: Error) => setError(e.message));
  useEffect(() => { void reload(); }, []);
  useEffect(() => { const urls = photos.map(file => URL.createObjectURL(file)); setPhotoUrls(urls); return () => urls.forEach(URL.revokeObjectURL); }, [photos]);
  const pick = (files: FileList | null) => { if (!files) return; const imgs = Array.from(files).filter(f => ["image/jpeg", "image/png", "image/webp"].includes(f.type)); const room = MAX - photos.length; if (imgs.length > room) setPhotoErr(`Tối đa ${MAX} ảnh.`); else if (imgs.length < files.length) setPhotoErr("Chỉ hỗ trợ JPG, PNG hoặc WEBP."); else setPhotoErr(""); setPhotos([...photos, ...imgs.slice(0, Math.max(room, 0))]); if (fileRef.current) fileRef.current.value = ""; };
  const removePhoto = (index: number) => setPhotos(photos.filter((_, i) => i !== index));
  const submit = async () => { if (!text.trim() || !roomId || busy) return; setBusy(true); setError(""); try { const imageUrls = await Promise.all(photos.map(file => assetApi.uploadImage(file))); await assetApi.createReport({ roomId: Number(roomId), title: cat, description: text.trim(), imageUrls }); setText(""); setPhotos([]); setPhotoUrls([]); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Gửi yêu cầu thất bại."); } finally { setBusy(false); } };
  return <section className="cx-section !pt-32"><div className="cx-eyebrow">Hỗ trợ kỹ thuật · phản hồi trong 24 giờ</div><h1 className="cx-serif cx-h2">Có gì <em>trục trặc</em>? Nói với chúng tôi.</h1>
    {error && <p className="cx-err">{error}</p>}<div className="cx-repair"><div className="cx-panel h-fit"><h3 className="cx-panel-title">Loại sự cố</h3>
      <label className="mb-3 block text-xs">Mã phòng đang thuê<input className="cx-textarea mt-1" type="number" min="1" value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Ví dụ: 12" /></label>
      <div className="cx-cats">{cats.map(c => <motion.button key={c.k} whileTap={{ scale: .94 }} className={cat === c.k ? "on" : ""} onClick={() => setCat(c.k)}><span className="text-xl">{c.e}</span>{c.k}</motion.button>)}</div>
      <textarea className="cx-textarea" rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Mô tả sự cố và khung giờ thuận tiện để kỹ thuật vào phòng…" />
      <label className="cx-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files); }}><input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => pick(e.target.files)} /><Icon name="plus" size={18} /> Kéo thả hoặc chọn ảnh · {photos.length}/{MAX}</label>
      {photoErr && <p className="cx-err -mt-2 mb-3">{photoErr}</p>}<div className="cx-thumbs">{photos.map((p, i) => <div key={`${p.name}-${i}`}><img src={photoUrls[i]} alt={p.name} /><button type="button" onClick={() => removePhoto(i)}><Icon name="close" size={12} /></button></div>)}</div>
      <motion.button className="cx-btn w-full" whileTap={{ scale: .97 }} disabled={!text.trim() || !roomId || busy} onClick={() => void submit()}>{busy ? "Đang gửi…" : "Gửi yêu cầu"}</motion.button></div>
      <div className="space-y-4"><AnimatePresence initial={false}>{list.map(r => <motion.article key={r.id} layout className="cx-panel" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between"><span className="cx-meta">#{r.id} · {r.title}</span><span className="cx-status">{statusText[r.status] ?? r.status}</span></div><h3 className="cx-serif mt-3 text-2xl">{r.description}</h3><div className="mt-1 text-xs text-[#6b777d]">Phòng {r.roomId} · Gửi lúc {r.createdAt ? toVNTime(r.createdAt, true) : "—"}</div>
        {r.rejectReason && <p className="cx-err">Lý do từ chối: {r.rejectReason}</p>}<div className="cx-thumbs !mb-0 mt-4">{(r.imageUrls ?? []).map(u => <div key={u}><img src={u} alt="Ảnh sự cố" /></div>)}</div>
      </motion.article>)}</AnimatePresence>{list.length === 0 && <div className="cx-panel">Bạn chưa gửi báo cáo sự cố nào.</div>}</div>
    </div></section>;
}
