import { lazy, Suspense, useMemo, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Icon, vnd } from "../../ui";
import { useNavigate } from "react-router";
import { areas, buildings, roomTypes, rooms, type Room } from "./data";
import { haversine, HCM_CENTER } from "../../lib/geo";
import { useAuth } from "../../lib/auth";
import { bookingStore, slotHours, upcomingDays, vnToIso } from "./bookings";

type R = Room & { km: number };
const withKm: R[] = rooms.filter((r) => r.status === "ACTIVE").map((r) => ({ ...r, km: Math.round(haversine(HCM_CENTER, r) * 10) / 10 }));

const Room3D = lazy(() => import("./Room3D"));
const ease = [0.22, 1, 0.36, 1] as const;

function TiltCard({ room, i, gps, onOpen }: { room: R; i: number; gps: boolean; onOpen: () => void }) {
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 200, damping: 18 });
  return (
    <motion.article
      layout
      className="cx-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.5, delay: i * 0.06, ease }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onMouseMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - b.left) / b.width - 0.5); my.set((e.clientY - b.top) / b.height - 0.5); }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      onClick={onOpen}
    >
      <div className="cx-card-img"><img src={room.img} alt={room.title} loading="lazy" />{room.shared && <span className="cx-tag">Ở ghép</span>}{gps && <span className="cx-km">{room.km.toLocaleString("vi-VN")} km</span>}</div>
      <div className="cx-card-body">
        <div className="cx-meta">{room.building} · {room.district}</div>
        <h3>{room.title}</h3>
        <div className="flex items-end justify-between">
          <div><b>{vnd(room.price)}</b><span>{room.shared ? " / người" : " / tháng"}</span></div>
          <span className="cx-meta">{room.area} m² · Tầng {room.floor}</span>
        </div>
      </div>
    </motion.article>
  );
}

function RoomSheet({ room, onClose }: { room: R; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const days = useMemo(() => upcomingDays(5), []);
  const [day, setDay] = useState(days[0].ymd);
  const [slot, setSlot] = useState("");
  const request = () => (sent ? navigate("/lich-hen") : user ? setPicking(true) : navigate("/dang-nhap?next=/"));
  const confirm = () => {
    bookingStore.addRequest({ room: room.code, building: room.building, price: room.price, at: new Date().toISOString() }, vnToIso(day, slot));
    setPicking(false); setSent(true);
  };
  return (
    <>
      <motion.div className="cx-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside className="cx-sheet" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.5, ease }}>
        <button className="cx-close" onClick={onClose} aria-label="Đóng"><Icon name="close" size={18} /></button>
        <div className="cx-sheet-3d">
          <Suspense fallback={<div className="cx-loading">Đang dựng phòng 3D…</div>}><Room3D shared={room.shared} /></Suspense>
          <span className="cx-hint">Kéo để xoay phòng</span>
        </div>
        <div className="p-7">
          <div className="cx-meta">Phòng {room.code} · {room.building}</div>
          <h2 className="cx-serif mt-2 text-[34px] leading-[1.05]">{room.title}</h2>
          <div className="mt-5 flex flex-wrap gap-2">{room.perks.map((p) => <span key={p} className="cx-chip static">{p}</span>)}</div>
          <dl className="cx-specs">
            <div><dt>Giá thuê</dt><dd>{vnd(room.price)}</dd></div>
            <div><dt>Diện tích</dt><dd>{room.area} m²</dd></div>
            <div><dt>Tiền cọc</dt><dd>{vnd(room.price * 2)}</dd></div>
            <div><dt>Khoảng cách</dt><dd>{room.km.toLocaleString("vi-VN")} km</dd></div>
          </dl>
          <p className="text-sm leading-7 text-[#56636a]">Điện {vnd(3500)}/kWh · Nước {vnd(18000)}/m³. Hóa đơn hằng tháng tự động chia đều theo số người ở trong phòng.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button className="cx-btn ghost" onClick={() => (user ? setPicking(true) : navigate("/dang-nhap?next=/"))}>Đặt lịch xem</button>
            <motion.button className="cx-btn" whileTap={{ scale: 0.96 }} onClick={request}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={String(sent)} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="flex items-center gap-2">
                  {sent ? <><Icon name="check" size={16} /> Đã gửi · xem lịch hẹn</> : "Gửi yêu cầu thuê"}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
          <AnimatePresence>
            {picking && !sent && (
              <motion.div className="cx-panel mt-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.4, ease }}>
                <h3 className="cx-panel-title">Chọn khung giờ xem phòng</h3>
                <div className="cx-chips">{days.map((d) => <button key={d.ymd} className={`cx-chip ${day === d.ymd ? "on" : ""}`} onClick={() => { setDay(d.ymd); setSlot(""); }}>{d.label}</button>)}</div>
                <div className="cx-slots">
                  {slotHours.map((h, i) => <button key={h} className={slot === h ? "on" : ""} disabled={(i + day.charCodeAt(9)) % 4 === 0} onClick={() => setSlot(h)}>{h}</button>)}
                </div>
                <p className="mt-3 text-xs text-[#6b777d]">Nhân viên sẽ gọi xác nhận trong 2 giờ. Bạn có thể hủy trong mục Lịch hẹn.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button className="cx-btn ghost !h-11" onClick={() => setPicking(false)}>Để sau</button>
                  <button className="cx-btn !h-11" disabled={!slot} onClick={confirm}>Xác nhận {slot && `${slot}`}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
    </>
  );
}

export default function Explore() {
  const [b, setB] = useState(buildings[0]);
  const [open, setOpen] = useState<R | null>(null);
  const [province, setProvince] = useState("TP. Hồ Chí Minh");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [building, setBuilding] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [gps, setGps] = useState(false);
  const [radius, setRadius] = useState(5);
  const [max, setMax] = useState(6000000);
  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return withKm
      .filter((r) => r.province === province && (!district || r.district === district) && (!ward || r.ward === ward) && (!building || r.building === building))
      .filter((r) => (!type || r.type === type) && r.price <= max && (!gps || r.km <= radius))
      .filter((r) => !kw || `${r.title} ${r.building} ${r.perks.join(" ")}`.toLowerCase().includes(kw))
      .sort((x, y) => (gps ? x.km - y.km : 0));
  }, [province, district, ward, building, type, q, max, gps, radius]);
  const reset = () => { setDistrict(""); setWard(""); setBuilding(""); setType(""); setQ(""); setGps(false); setMax(6000000); };
  const hereRooms = withKm.filter((r) => r.building === b.name);
  const minPrice = Math.min(...hereRooms.map((r) => r.price));

  return (
    <>
      <section className="cx-hero">
        <div className="cx-hero-copy">
          <motion.div className="cx-eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}><span className="cx-live" /> {rooms.length} phòng đang trống tại TP.HCM</motion.div>
          <h1 className="cx-serif cx-h1">
            {["Một căn phòng", "đúng nhịp sống", "của bạn."].map((l, i) => (
              <span key={l} className="block overflow-hidden"><motion.span className="block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.15 + i * 0.1, ease }}>{i === 2 ? <em>{l}</em> : l}</motion.span></span>
            ))}
          </h1>
          <motion.p className="cx-lead" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}>
            Chọn một tòa nhà, xem ngay các phòng còn trống, giá thuê và bố cục nội thất 3D, không cần đến tận nơi.
          </motion.p>
          <motion.div className="cx-switch" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6 }}>
            {buildings.map((x) => (
              <button key={x.key} onClick={() => setB(x)} className={b.key === x.key ? "on" : ""}>
                {b.key === x.key && <motion.span layoutId="bld" className="cx-switch-pill" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <span className="relative"><b>{x.name}</b><small>{x.district}</small></span>
              </button>
            ))}
          </motion.div>
        </div>
        <div className="cx-stage">
          <AnimatePresence mode="popLayout">
            <motion.div key={b.key} className="cx-stage-photo" initial={{ clipPath: "inset(0 0 100% 0 round 32px)" }} animate={{ clipPath: "inset(0 0 0% 0 round 32px)" }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease }}>
              <motion.img src={hereRooms[0]?.img} alt={`Không gian ${b.name}`} initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease }} />
            </motion.div>
          </AnimatePresence>
          <motion.div key={`stat-${b.key}`} className="cx-float cx-float-stat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6, ease }}>
            <span className="cx-meta">Đang xem</span>
            <b className="cx-serif">{b.name}</b>
            <div className="cx-float-row">
              <div><small>Phòng trống</small><strong>{hereRooms.length}</strong></div>
              <div><small>Giá từ</small><strong>{(minPrice / 1e6).toLocaleString("vi-VN")} tr</strong></div>
              <div><small>Số tầng</small><strong>{b.floors}</strong></div>
            </div>
          </motion.div>
          <motion.div key={`live-${b.key}`} className="cx-float cx-float-live" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.6, ease }}>
            <span className="cx-live" /> 3 người đang xem tòa này
          </motion.div>
          <div className="cx-strip">
            {hereRooms.map((r, i) => (
              <motion.button key={r.id} className="cx-strip-item" onClick={() => setOpen(r)} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + i * 0.08, duration: 0.5, ease }} whileHover={{ y: -4 }}>
                <img src={r.img} alt="" />
                <span><b>P.{r.code}</b><small>{vnd(r.price)}</small></span>
                <Icon name="arrow" size={16} />
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <section className="cx-section">
        <div className="cx-filter">
          <label className="cx-search"><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Từ khóa: ban công, bếp riêng, gần trường…" /></label>
          <div className="cx-selects">
            <select value={province} onChange={(e) => { setProvince(e.target.value); setDistrict(""); setWard(""); }}>{Object.keys(areas).map((p) => <option key={p}>{p}</option>)}</select>
            <select value={district} onChange={(e) => { setDistrict(e.target.value); setWard(""); }}><option value="">Mọi quận / huyện</option>{Object.keys(areas[province]).map((d) => <option key={d}>{d}</option>)}</select>
            <select value={ward} disabled={!district} onChange={(e) => setWard(e.target.value)}><option value="">Mọi phường / xã</option>{district && areas[province][district].map((w) => <option key={w}>{w}</option>)}</select>
            <select value={building} onChange={(e) => setBuilding(e.target.value)}><option value="">Mọi tòa nhà</option>{buildings.map((x) => <option key={x.key}>{x.name}</option>)}</select>
          </div>
          <div className="cx-filter-row">
            <div className="cx-chips">
              <button className={`cx-chip ${!type ? "on" : ""}`} onClick={() => setType("")}>Tất cả loại</button>
              {roomTypes.map((t) => <button key={t} className={`cx-chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>{t}</button>)}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="cx-range"><span>Giá tối đa <b>{(max / 1e6).toLocaleString("vi-VN")} tr</b></span><input type="range" min={1500000} max={6000000} step={100000} value={max} onChange={(e) => setMax(+e.target.value)} /></label>
              <button className={`cx-chip ${gps ? "on" : ""}`} onClick={() => setGps(!gps)}><Icon name="pin" size={14} /> Quanh tôi</button>
              <AnimatePresence>
                {gps && (
                  <motion.label className="cx-range" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}>
                    <span>Bán kính <b>{radius} km</b></span><input type="range" min={1} max={15} value={radius} onChange={(e) => setRadius(+e.target.value)} />
                  </motion.label>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="cx-grid-head"><h2 className="cx-serif">{list.length} phòng phù hợp</h2><span className="cx-meta">{gps ? "Gần nhất trước · tính từ vị trí của bạn" : "Chỉ hiển thị tin đang hiển thị"}</span></div>
        <motion.div layout className="cx-grid">
          <AnimatePresence mode="popLayout">
            {list.map((r, i) => <TiltCard key={r.id} room={r} i={i} gps={gps} onOpen={() => setOpen(r)} />)}
          </AnimatePresence>
        </motion.div>
        {list.length === 0 && <div className="cx-empty">Không có phòng phù hợp. <button className="cx-link !p-0 underline" onClick={reset}>Xóa bộ lọc</button></div>}
      </section>

      <AnimatePresence>{open && <RoomSheet room={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </>
  );
}
