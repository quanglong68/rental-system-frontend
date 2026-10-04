import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Icon } from "../../ui";
import { DEMO_PASSWORD, demoAccounts, homeFor, useAuth } from "../../lib/auth";
import "./auth.css";

const ease = [0.22, 1, 0.36, 1] as const;
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isPhone = (v: string) => /^(0|\+84)(3|5|7|8|9)\d{8}$/.test(v.replace(/\s/g, ""));

function Shell({ title, sub, children }: { title: React.ReactNode; sub: string; children: React.ReactNode }) {
  return (
    <div className="au">
      <motion.aside className="au-art" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
        <motion.img src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=1400" alt="Không gian phòng sáng sủa" initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 1.8, ease }} />
        <Link to="/" className="au-brand"><span className="logo-mark !h-8 !w-8"><span></span><span></span><span></span></span> Nhà Mình</Link>
        <motion.blockquote initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8, ease }}>
          “Hóa đơn chia rõ từng ngày, báo hư là có người tới. Lần đầu tiên thuê phòng mà thấy nhẹ đầu.”
          <cite>Hoàng Thị Mai · khách thuê tại The Fern House</cite>
        </motion.blockquote>
      </motion.aside>
      <main className="au-main">
        <motion.div className="au-form" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <Link to="/" className="au-back"><Icon name="arrow" size={14} /> Về trang tìm phòng</Link>
          <h1 className="cx-serif">{title}</h1>
          <p className="au-sub">{sub}</p>
          {children}
        </motion.div>
      </main>
    </div>
  );
}

function Field({ label, error, ...p }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const pw = p.type === "password";
  return (
    <label className={`au-field ${error ? "bad" : ""}`}>
      <span>{label}</span>
      <div><input {...p} type={pw && show ? "text" : p.type} />{pw && <button type="button" onClick={() => setShow(!show)}>{show ? "Ẩn" : "Hiện"}</button>}</div>
      {error && <motion.small initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.small>}
    </label>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) return setError("Vui lòng nhập đầy đủ thông tin.");
    setLoading(true);
    try {
      const u = await login(username, password);
      const next = params.get("next");
      navigate(next && u.role === "CUSTOMER" ? next : homeFor(u.role), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title={<>Chào mừng <em>trở lại</em>.</>} sub="Đăng nhập bằng email hoặc số điện thoại đã đăng ký.">
      <form onSubmit={submit} noValidate>
        <Field label="Email hoặc số điện thoại" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="ban@email.com" />
        <Field label="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
        {error && <motion.div className="au-error" initial={{ x: -8 }} animate={{ x: [0, -6, 6, -3, 0] }}>{error}</motion.div>}
        <button className="cx-btn w-full" disabled={loading}>{loading ? <span className="au-spin" /> : "Đăng nhập"}</button>
      </form>
      <p className="au-alt">Chưa có tài khoản? <Link to="/dang-ky">Đăng ký người thuê</Link></p>
      {(
        <div className="au-demo">
          <div className="cx-meta">Tài khoản mẫu để xem giao diện · mật khẩu <b>{DEMO_PASSWORD}</b></div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {demoAccounts.map((a) => <button key={a.sub} type="button" className="cx-chip !py-1.5 !text-xs" onClick={() => { setUsername(a.sub); setPassword(DEMO_PASSWORD); }}>{a.role}</button>)}
          </div>
        </div>
      )}
    </Shell>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ fullName: "", username: "", password: "", confirm: "" });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const errs = {
    fullName: f.fullName.trim().length < 2 ? "Vui lòng nhập họ tên." : "",
    username: !isEmail(f.username) && !isPhone(f.username) ? "Nhập email hợp lệ hoặc số điện thoại Việt Nam (10 số)." : "",
    password: f.password.length < 8 ? "Mật khẩu tối thiểu 8 ký tự." : "",
    confirm: f.confirm !== f.password ? "Mật khẩu nhập lại không khớp." : "",
  };
  const strength = Math.min(4, [f.password.length >= 8, /[A-Z]/.test(f.password), /\d/.test(f.password), /[^A-Za-z0-9]/.test(f.password)].filter(Boolean).length);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError("");
    if (Object.values(errs).some(Boolean)) return;
    setLoading(true);
    try {
      await register({ fullName: f.fullName.trim(), username: f.username.trim().replace(/\s/g, ""), password: f.password });
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title={<>Tìm phòng <em>dễ hơn</em> từ hôm nay.</>} sub="Tạo tài khoản người thuê để gửi yêu cầu thuê, đặt lịch xem phòng và nhận hóa đơn.">
      <form onSubmit={submit} noValidate>
        <Field label="Họ và tên" value={f.fullName} onChange={set("fullName")} error={touched ? errs.fullName : ""} placeholder="Nguyễn Văn A" />
        <Field label="Email hoặc số điện thoại" value={f.username} onChange={set("username")} error={touched ? errs.username : ""} placeholder="ban@email.com hoặc 09xx xxx xxx" />
        <Field label="Mật khẩu" type="password" value={f.password} onChange={set("password")} error={touched ? errs.password : ""} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" />
        <div className="au-meter">{[0, 1, 2, 3].map((i) => <i key={i} className={i < strength ? `on s${strength}` : ""} />)}<span>{["Quá ngắn", "Yếu", "Trung bình", "Khá", "Mạnh"][strength]}</span></div>
        <Field label="Nhập lại mật khẩu" type="password" value={f.confirm} onChange={set("confirm")} error={touched ? errs.confirm : ""} autoComplete="new-password" />
        {error && <div className="au-error">{error}</div>}
        <button className="cx-btn w-full" disabled={loading}>{loading ? <span className="au-spin" /> : "Tạo tài khoản"}</button>
      </form>
      <p className="au-alt">Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link></p>
    </Shell>
  );
}
