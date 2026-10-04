import { useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Icon, toVNTime, vnd } from "../../ui";
import { useCxToast } from "./notifications";

const people = [
  { name: "Đặng Thu Trang", age: 24, job: "Nhân viên văn phòng", budget: 2500000, area: "Bình Thạnh", tags: ["Không hút thuốc", "Ngủ sớm", "Hay nấu ăn"], match: 92, img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=faces&fit=crop&w=700&h=900&q=80" },
  { name: "Võ Minh Thư", age: 27, job: "Designer", budget: 3000000, area: "Quận 3", tags: ["Làm việc tại nhà", "Yên tĩnh"], match: 85, img: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?crop=faces&fit=crop&w=700&h=900&q=80" },
  { name: "Lê Hoàng Phúc", age: 21, job: "Sinh viên", budget: 1800000, area: "Thủ Đức", tags: ["Nuôi mèo", "Hay chơi game"], match: 71, img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=faces&fit=crop&w=700&h=900&q=80" },
  { name: "Ngô Bảo Châu", age: 25, job: "Kỹ sư phần mềm", budget: 2800000, area: "Bình Thạnh", tags: ["Ngủ sớm", "Tập gym"], match: 88, img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=faces&fit=crop&w=700&h=900&q=80" },
];
type P = (typeof people)[0];

function SwipeCard({ p, top, onDecide }: { p: P; top: boolean; onDecide: (like: boolean) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const like = useTransform(x, [30, 140], [0, 1]);
  const nope = useTransform(x, [-140, -30], [1, 0]);
  const end = (_: unknown, info: PanInfo) => { if (Math.abs(info.offset.x) > 120) onDecide(info.offset.x > 0); };
  return (
    <motion.div
      className="cx-swipe"
      style={{ x, rotate, zIndex: top ? 2 : 1 }}
      drag={top ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={end}
      initial={{ scale: 0.92, y: 24, opacity: 0 }}
      animate={{ scale: top ? 1 : 0.94, y: top ? 0 : 18, opacity: 1 }}
      exit={{ x: x.get() >= 0 ? 520 : -520, opacity: 0, rotate: x.get() >= 0 ? 20 : -20, transition: { duration: 0.35 } }}
    >
      <img src={p.img} alt={p.name} draggable={false} />
      <motion.span className="cx-stamp like" style={{ opacity: like }}>Hợp nhau</motion.span>
      <motion.span className="cx-stamp nope" style={{ opacity: nope }}>Bỏ qua</motion.span>
      <div className="cx-swipe-info">
        <div className="flex items-end justify-between"><div><h3 className="cx-serif">{p.name}, {p.age}</h3><div className="text-sm text-white/75">{p.job} · {p.area}</div></div><div className="cx-match">{p.match}%</div></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{p.tags.map((t) => <span key={t}>{t}</span>)}</div>
        <div className="mt-3 text-sm text-white/80">Ngân sách {vnd(p.budget)} / tháng</div>
      </div>
    </motion.div>
  );
}

function SwipeView() {
  const [deck, setDeck] = useState(people);
  const [liked, setLiked] = useState<P[]>([]);
  const decide = (like: boolean) => { const [head, ...rest] = deck; if (like) setLiked([head, ...liked]); setDeck(rest); };
  return (
      <div className="cx-mates">
        <div>
          <div className="cx-deck">
            <AnimatePresence>
              {deck.slice(0, 2).reverse().map((p) => <SwipeCard key={p.name} p={p} top={p === deck[0]} onDecide={decide} />)}
            </AnimatePresence>
            {deck.length === 0 && <div className="cx-deck-empty"><b className="cx-serif text-3xl">Hết gợi ý rồi.</b><button className="cx-btn ghost mt-4" onClick={() => { setDeck(people); setLiked([]); }}>Xem lại từ đầu</button></div>}
          </div>
          {deck.length > 0 && (
            <div className="cx-deck-actions">
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => decide(false)} aria-label="Bỏ qua"><Icon name="close" size={22} /></motion.button>
              <span className="cx-meta">Kéo thẻ sang trái / phải</span>
              <motion.button whileTap={{ scale: 0.88 }} className="yes" onClick={() => decide(true)} aria-label="Hợp nhau"><Icon name="check" size={22} /></motion.button>
            </div>
          )}
        </div>
        <div className="cx-panel h-fit">
          <h3 className="cx-panel-title">Lời mời đã gửi · {liked.length}</h3>
          {liked.length === 0 && <p className="text-sm text-[#6b777d]">Chưa có ai. Vuốt phải để gửi lời mời ở ghép.</p>}
          <AnimatePresence>
            {liked.map((p) => (
              <motion.div key={p.name} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="cx-person">
                <img src={p.img} alt="" className="h-10 w-10 rounded-full object-cover" />
                <span className="flex-1"><b className="block text-sm">{p.name}</b><small className="text-[#6b777d]">{p.area} · {p.match}% hợp</small></span>
                <span className="cx-status">Chờ phản hồi</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
  );
}

type Gender = "Nam" | "Nữ" | "Không yêu cầu";
type Post = { id: string; author: string; room: string; building: string; slots: number; price: number; gender: Gender; desc: string; at: string };
type Applicant = { id: string; name: string; job: string; msg: string; at: string; status: "Chờ duyệt" | "Đã nhận" | "Từ chối" };

const posts: Post[] = [
  { id: "OG-31", author: "Đặng Thu Trang", room: "201", building: "The Fern House", slots: 1, price: 2100000, gender: "Nữ", desc: "Phòng 28 m², bếp chung sạch sẽ, mình làm văn phòng, ngủ trước 23h.", at: "2026-10-02T03:00:00Z" },
  { id: "OG-28", author: "Lê Hoàng Phúc", room: "302", building: "Lam Garden", slots: 2, price: 1800000, gender: "Không yêu cầu", desc: "Gần ĐH Quốc gia, có nuôi một bé mèo, ưu tiên sinh viên.", at: "2026-09-29T11:20:00Z" },
  { id: "OG-25", author: "Ngô Bảo Châu", room: "502", building: "Căn hộ An Nhiên", slots: 1, price: 2200000, gender: "Nam", desc: "View Phú Mỹ Hưng, hồ bơi chung, tìm bạn nam đi làm, không hút thuốc.", at: "2026-09-27T08:45:00Z" },
];
const seedApplicants: Applicant[] = [
  { id: "a1", name: "Võ Minh Thư", job: "Designer", msg: "Mình làm việc tại nhà, rất yên tĩnh, có thể dọn vào đầu tháng 11.", at: "2026-10-03T07:10:00Z", status: "Chờ duyệt" },
  { id: "a2", name: "Phan Ngọc Hân", job: "Sinh viên năm cuối", msg: "Mình gọn gàng, hay nấu ăn, muốn tìm phòng gần Bình Thạnh.", at: "2026-10-02T13:30:00Z", status: "Chờ duyệt" },
];
const tabs = ["Gợi ý ghép đôi", "Tin ở ghép", "Tin của tôi"] as const;

function PostsView({ applied, onApply }: { applied: Record<string, string>; onApply: (id: string, msg: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {posts.map((p, i) => (
        <motion.article key={p.id} className="cx-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <div className="flex items-center justify-between"><span className="cx-meta">{p.id} · {p.author} · {toVNTime(p.at)}</span><span className="cx-status mute">Còn {p.slots} chỗ</span></div>
          <h3 className="cx-serif mt-3 text-2xl">P.{p.room} · {p.building}</h3>
          <p className="text-sm leading-6 text-[#56636a]">{p.desc}</p>
          <div className="flex flex-wrap gap-2"><span className="cx-chip static">{vnd(p.price)} / người</span><span className="cx-chip static">Giới tính: {p.gender}</span></div>
          {applied[p.id] ? (
            <div className="cx-confirm"><span className="cx-status">Đã ứng tuyển · chờ phản hồi</span><p className="m-0 mt-2 text-[#56636a]">“{applied[p.id]}”</p></div>
          ) : openId === p.id ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <textarea className="cx-textarea" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Giới thiệu ngắn về bạn và thời gian muốn dọn vào…" />
              <div className="flex gap-2"><button className="cx-btn !h-10 flex-1" disabled={!msg.trim()} onClick={() => { onApply(p.id, msg.trim()); setOpenId(null); setMsg(""); }}>Gửi ứng tuyển</button><button className="cx-btn ghost !h-10" onClick={() => setOpenId(null)}>Hủy</button></div>
            </motion.div>
          ) : (
            <button className="cx-btn ghost mt-4 !h-10 w-full" onClick={() => { setOpenId(p.id); setMsg(""); }}>Ứng tuyển ở ghép</button>
          )}
        </motion.article>
      ))}
    </div>
  );
}

function MyPostView({ toast }: { toast: (m: string) => void }) {
  const [mine, setMine] = useState<Post | null>(null);
  const [f, setF] = useState({ room: "402 · The Fern House", slots: 1, price: 2100000, gender: "Nữ" as Gender, desc: "" });
  const [apps, setApps] = useState(seedApplicants);
  const decide = (id: string, ok: boolean) => { setApps(apps.map((a) => (a.id === id ? { ...a, status: ok ? "Đã nhận" : "Từ chối" } : a))); toast(ok ? "Đã nhận người ở ghép" : "Đã từ chối ứng viên"); };
  const accepted = apps.filter((a) => a.status === "Đã nhận").length;
  if (!mine) {
    return (
      <div className="cx-panel max-w-[720px]">
        <h3 className="cx-panel-title">Đăng tin tìm người ở ghép</h3>
        <div className="cx-form">
          <label className="cx-field full">Phòng<select className="cx-input" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })}><option>402 · The Fern House</option></select></label>
          <label className="cx-field">Số chỗ trống<input className="cx-input" type="number" min={1} max={4} value={f.slots} onChange={(e) => setF({ ...f, slots: Math.max(1, Math.min(4, +e.target.value)) })} /></label>
          <label className="cx-field">Chia tiền phòng / người<input className="cx-input" type="number" step={50000} min={0} value={f.price} onChange={(e) => setF({ ...f, price: +e.target.value })} /><span className="cx-meta">Hiển thị: {vnd(f.price)}</span></label>
          <div className="cx-field full">Ưu tiên giới tính<div className="cx-chips">{(["Nam", "Nữ", "Không yêu cầu"] as Gender[]).map((g) => <button key={g} type="button" className={`cx-chip ${f.gender === g ? "on" : ""}`} onClick={() => setF({ ...f, gender: g })}>{g}</button>)}</div></div>
          <label className="cx-field full">Mô tả<textarea className="cx-textarea !m-0" rows={4} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="Thói quen sinh hoạt, tiện ích phòng, thời gian dọn vào…" /></label>
        </div>
        <motion.button className="cx-btn mt-5 w-full" whileTap={{ scale: 0.97 }} disabled={!f.desc.trim() || f.price <= 0} onClick={() => { const [room, building] = f.room.split(" · "); setMine({ id: "OG-34", author: "Bạn", room, building, slots: f.slots, price: f.price, gender: f.gender, desc: f.desc.trim(), at: new Date().toISOString() }); toast("Đã đăng tin ở ghép"); }}>Đăng tin</motion.button>
      </div>
    );
  }
  return (
    <div className="cx-two">
      <motion.article className="cx-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between"><span className="cx-meta">{mine.id} · đăng {toVNTime(mine.at, true)}</span><span className="cx-status ok">Đang hiển thị</span></div>
        <h3 className="cx-serif mt-3 text-[28px]">P.{mine.room} · {mine.building}</h3>
        <p className="text-sm leading-6 text-[#56636a]">{mine.desc}</p>
        <div className="flex flex-wrap gap-2"><span className="cx-chip static">{vnd(mine.price)} / người</span><span className="cx-chip static">Còn {Math.max(0, mine.slots - accepted)}/{mine.slots} chỗ</span><span className="cx-chip static">{mine.gender}</span></div>
        <button className="cx-btn ghost mt-5 !h-10 w-full" onClick={() => { setMine(null); toast("Đã gỡ tin"); }}>Gỡ tin</button>
      </motion.article>
      <div className="cx-panel">
        <h3 className="cx-panel-title">Người ứng tuyển · {apps.length}</h3>
        <AnimatePresence initial={false}>
          {apps.map((a) => (
            <motion.div key={a.id} layout className="cx-person !block" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center gap-3">
                <span className="cx-av">{a.name.split(" ").pop()![0]}</span>
                <span className="flex-1"><b className="block text-sm">{a.name}</b><small className="text-[#6b777d]">{a.job} · {toVNTime(a.at, true)}</small></span>
                {a.status !== "Chờ duyệt" && <span className={`cx-status ${a.status === "Đã nhận" ? "ok" : "bad"}`}>{a.status}</span>}
              </div>
              <p className="my-2 text-sm text-[#56636a]">“{a.msg}”</p>
              {a.status === "Chờ duyệt" && (
                <div className="flex gap-2"><button className="cx-btn !h-10 flex-1" disabled={accepted >= mine.slots} onClick={() => decide(a.id, true)}>Nhận</button><button className="cx-btn ghost !h-10 flex-1" onClick={() => decide(a.id, false)}>Từ chối</button></div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Roommates() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Gợi ý ghép đôi");
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [toast, show] = useCxToast();
  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Ở ghép · tiết kiệm tới 45% chi phí</div>
      <h1 className="cx-serif cx-h2">Tìm người <em>cùng nhịp</em> sống.</h1>
      <div className="cx-seg">
        {tabs.map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {tab === t && <motion.span layoutId="mate-tab" className="cx-seg-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
          {tab === "Gợi ý ghép đôi" && <SwipeView />}
          {tab === "Tin ở ghép" && <PostsView applied={applied} onApply={(id, msg) => { setApplied({ ...applied, [id]: msg }); show("Đã gửi ứng tuyển"); }} />}
          {tab === "Tin của tôi" && <MyPostView toast={show} />}
        </motion.div>
      </AnimatePresence>
      {toast}
    </section>
  );
}
