import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation } from "react-router";
import { toVNTime } from "../../ui";
import { useAuth } from "../../lib/auth";
import { notiStore, useCxToast, useNotis, type NotiKind } from "./notifications";

const filters: ("Tất cả" | NotiKind)[] = ["Tất cả", "Hóa đơn", "Lịch hẹn", "Sửa chữa", "Ở ghép"];
const ease = [0.22, 1, 0.36, 1] as const;

export default function Profile() {
  const { user } = useAuth();
  const loc = useLocation();
  const [toast, show] = useCxToast();
  const [form, setForm] = useState({ name: user?.fullName ?? "", phone: "0903218447", email: "mai.hoang@gmail.com", cccd: "079201004512", dob: "2001-05-14", hometown: "Quảng Ngãi" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ cur: "", next: "", again: "" });
  const [pwErr, setPwErr] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Tất cả");
  const notis = useNotis();
  const shown = notis.filter((n) => filter === "Tất cả" || n.kind === filter);
  const unread = notis.filter((n) => !n.read).length;

  useEffect(() => { if (loc.hash === "#thong-bao") document.getElementById("thong-bao")?.scrollIntoView({ behavior: "smooth" }); }, [loc.hash]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const save = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Vui lòng nhập họ tên.";
    if (!/^0\d{9}$/.test(form.phone)) e.phone = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Email không hợp lệ.";
    if (!/^\d{12}$/.test(form.cccd)) e.cccd = "CCCD gồm 12 chữ số.";
    setErrs(e);
    if (!Object.keys(e).length) show("Đã lưu hồ sơ của bạn");
  };
  const changePw = () => {
    if (!pw.cur) return setPwErr("Vui lòng nhập mật khẩu hiện tại.");
    if (pw.next.length < 8) return setPwErr("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (pw.next !== pw.again) return setPwErr("Mật khẩu nhập lại không khớp.");
    setPwErr(""); setPw({ cur: "", next: "", again: "" }); show("Đã đổi mật khẩu");
  };
  const initials = form.name.split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("");

  const input = (k: keyof typeof form, label: string, type = "text", full = false) => (
    <label className={`cx-field ${full ? "full" : ""}`}>
      {label}
      <input className={`cx-input ${errs[k] ? "bad" : ""}`} type={type} value={form[k]} onChange={set(k)} />
      {errs[k] && <span className="cx-err">{errs[k]}</span>}
    </label>
  );

  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Tài khoản · {user?.sub}</div>
      <h1 className="cx-serif cx-h2">Hồ sơ <em>của bạn</em>.</h1>
      <div className="cx-two">
        <div className="cx-stack">
          <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            <h3 className="cx-panel-title">Thông tin cá nhân</h3>
            <div className="mb-6 flex items-center gap-4">
              <div className="cx-avatar-lg">{initials}</div>
              <div><b className="block">{form.name || "Chưa có tên"}</b><button className="cx-link !p-0 text-sm underline" onClick={() => show("Tải ảnh đại diện sẽ có sớm")}>Đổi ảnh đại diện</button></div>
            </div>
            <div className="cx-form">
              {input("name", "Họ và tên", "text", true)}
              {input("phone", "Số điện thoại", "tel")}
              {input("email", "Email", "email")}
              {input("cccd", "Số CCCD")}
              {input("dob", "Ngày sinh", "date")}
              {input("hometown", "Quê quán", "text", true)}
            </div>
            <motion.button className="cx-btn mt-6 w-full" whileTap={{ scale: 0.97 }} onClick={save}>Lưu thay đổi</motion.button>
          </motion.article>

          <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease }}>
            <h3 className="cx-panel-title">Đổi mật khẩu</h3>
            <div className="cx-form">
              <label className="cx-field full">Mật khẩu hiện tại<input className="cx-input" type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></label>
              <label className="cx-field">Mật khẩu mới<input className="cx-input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="Ít nhất 8 ký tự" /></label>
              <label className="cx-field">Nhập lại<input className="cx-input" type="password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></label>
            </div>
            {pwErr && <p className="cx-err mt-3">{pwErr}</p>}
            <button className="cx-btn ghost mt-5 w-full" onClick={changePw}>Cập nhật mật khẩu</button>
          </motion.article>
        </div>

        <motion.article id="thong-bao" className="cx-panel scroll-mt-28" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="cx-panel-title !m-0">Thông báo · {unread} chưa đọc</h3>
            <button className="cx-link !p-0 text-sm underline disabled:opacity-40" disabled={!unread} onClick={() => notiStore.markAll()}>Đánh dấu đã đọc tất cả</button>
          </div>
          <div className="cx-chips mb-3">
            {filters.map((f) => <button key={f} className={`cx-chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((n) => (
              <motion.div key={n.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`cx-noti ${n.read ? "read" : ""}`} onClick={() => notiStore.markRead(n.id)}>
                <span className="dot" />
                <span className="flex-1">
                  <b className="block">{n.title}</b>
                  <span className="block text-[13px] text-[#56636a]">{n.body}</span>
                  <small className="cx-meta">{n.kind} · {toVNTime(n.at, true)}</small>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {shown.length === 0 && <p className="text-sm text-[#6b777d]">Không có thông báo nào.</p>}
        </motion.article>
      </div>
      {toast}
    </section>
  );
}
