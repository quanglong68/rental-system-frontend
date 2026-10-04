import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon, toVNTime } from "../../components/ui";

const cats = [{ k: "Điện", e: "⚡" }, { k: "Nước", e: "💧" }, { k: "Máy lạnh", e: "❄️" }, { k: "Internet", e: "📶" }, { k: "Khóa cửa", e: "🔑" }, { k: "Khác", e: "✦" }];
const steps = ["Đã gửi", "Đã phân công", "Đang sửa", "Hoàn tất"];
const MAX = 5;
type Log = { at: string; text: string };
type Report = { id: string; cat: string; text: string; at: string; step: number; tech: string; photos: string[]; logs: Log[] };
const seed: Report[] = [
  { id: "BT-221", cat: "Internet", text: "Wifi rớt liên tục vào buổi tối", at: "2026-10-03T14:40:00Z", step: 1, tech: "Trần Minh", photos: [], logs: [
    { at: "2026-10-03T14:40:00Z", text: "Bạn đã gửi yêu cầu kèm mô tả" },
    { at: "2026-10-03T15:10:00Z", text: "Quản lý phân công KTV Trần Minh, hẹn chiều 05/10" },
  ] },
  { id: "BT-204", cat: "Máy lạnh", text: "Máy lạnh chảy nước xuống tường", at: "2026-09-30T12:10:00Z", step: 3, tech: "Trần Minh", photos: [], logs: [
    { at: "2026-09-30T12:10:00Z", text: "Bạn đã gửi yêu cầu kèm 2 ảnh" },
    { at: "2026-09-30T13:00:00Z", text: "Quản lý phân công KTV Trần Minh" },
    { at: "2026-10-01T02:30:00Z", text: "KTV đang vệ sinh dàn lạnh, thay ống thoát nước" },
    { at: "2026-10-01T08:00:00Z", text: "Hoàn tất · bạn đã xác nhận nghiệm thu" },
  ] },
];

export default function Repairs() {
  const [list, setList] = useState<Report[]>(seed);
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [photoErr, setPhotoErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const pick = (files: FileList | null) => {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = MAX - photos.length;
    if (imgs.length > room) setPhotoErr(`Chỉ được tải tối đa ${MAX} ảnh. Bạn đã chọn ${photos.length + imgs.length} ảnh, ${imgs.length - Math.max(room, 0)} ảnh bị bỏ qua.`);
    else setPhotoErr("");
    const added = imgs.slice(0, Math.max(room, 0)).map((f) => { const url = URL.createObjectURL(f); urls.current.push(url); return { url, name: f.name }; });
    setPhotos([...photos, ...added]);
    if (fileRef.current) fileRef.current.value = "";
  };
  const removePhoto = (url: string) => { URL.revokeObjectURL(url); setPhotos(photos.filter((p) => p.url !== url)); setPhotoErr(""); };
  const [cat, setCat] = useState("Điện");
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    const at = new Date().toISOString();
    setList([{ id: `BT-${223 + list.length}`, cat, text, at, step: 0, tech: "", photos: photos.map((p) => p.url), logs: [{ at, text: `Bạn đã gửi yêu cầu${photos.length ? ` kèm ${photos.length} ảnh` : ""}` }] }, ...list]);
    setText(""); setPhotos([]); setPhotoErr("");
  };
  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Hỗ trợ kỹ thuật · phản hồi trong 24 giờ</div>
      <h1 className="cx-serif cx-h2">Có gì <em>trục trặc</em>? Nói với chúng tôi.</h1>
      <div className="cx-repair">
        <div className="cx-panel h-fit">
          <h3 className="cx-panel-title">Loại sự cố</h3>
          <div className="cx-cats">
            {cats.map((c) => (
              <motion.button key={c.k} whileTap={{ scale: 0.94 }} className={cat === c.k ? "on" : ""} onClick={() => setCat(c.k)}>
                <span className="text-xl">{c.e}</span>{c.k}
              </motion.button>
            ))}
          </div>
          <textarea className="cx-textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Mô tả sự cố và khung giờ thuận tiện để kỹ thuật vào phòng…" />
          <label className="cx-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}>
            <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => pick(e.target.files)} />
            <Icon name="plus" size={18} /> Kéo thả hoặc chọn ảnh · {photos.length}/{MAX}
          </label>
          {photoErr && <p className="cx-err -mt-2 mb-3">{photoErr}</p>}
          {photos.length > 0 && (
            <div className="cx-thumbs">
              <AnimatePresence>
                {photos.map((p) => (
                  <motion.div key={p.url} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <img src={p.url} alt={p.name} />
                    <button type="button" aria-label={`Xóa ảnh ${p.name}`} onClick={() => removePhoto(p.url)}><Icon name="close" size={12} /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          <motion.button className="cx-btn w-full" whileTap={{ scale: 0.97 }} disabled={!text.trim()} onClick={submit}>Gửi yêu cầu</motion.button>
        </div>
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {list.map((r) => (
              <motion.article key={r.id} layout className="cx-panel" initial={{ opacity: 0, y: -20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
                <div className="flex items-center justify-between"><span className="cx-meta">{r.id} · {r.cat}</span><span className={`cx-status ${r.step === 3 ? "ok" : ""}`}>{steps[r.step]}</span></div>
                <h3 className="cx-serif mt-3 text-2xl">{r.text}</h3>
                <div className="mt-1 text-xs text-[#6b777d]">Gửi lúc {toVNTime(r.at, true)}{r.tech && ` · KTV ${r.tech}`}</div>
                <div className="cx-steps">
                  {steps.map((s, i) => (
                    <div key={s} className={i <= r.step ? "done" : ""}>
                      <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: i <= r.step ? 1 : 0 }} transition={{ duration: 0.5, delay: 0.15 * i }} />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
                {r.photos.length > 0 && <div className="cx-thumbs !mb-0 mt-4">{r.photos.map((u) => <div key={u}><img src={u} alt="Ảnh sự cố" /></div>)}</div>}
                <div className="cx-timeline">
                  {r.logs.map((l, i) => (
                    <motion.div key={i} className="done" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}><b className="block text-[13px]">{l.text}</b><small>{toVNTime(l.at, true)}</small></motion.div>
                  ))}
                  {r.step < 3 && <div><b className="block text-[13px]">Tiếp theo: {steps[r.step + 1]}</b><small>Đang chờ cập nhật</small></div>}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
