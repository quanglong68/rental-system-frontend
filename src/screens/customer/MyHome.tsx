import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Icon, toVNTime, vnd } from "../../components/ui";
import { HomeExtras } from "./MyHomeExtras";
import { segments, splitDaily } from "../../lib/split";

const items: [string, number][] = [["Tiền phòng", 4200000], ["Điện · 182 kWh", 637000], ["Nước · 10 m³", 180000], ["Dịch vụ", 300000]];
const total = items.reduce((s, [, v]) => s + v, 0);
const DAYS = 31;
const people = [
  { name: "Hoàng Thị Mai", me: true, from: 1, paid: false },
  { name: "Đỗ Minh Khoa", me: false, from: 10, paid: true },
].map((p) => ({ ...p, days: DAYS - p.from + 1 }));
const split = splitDaily(total, DAYS, people.map((p) => [p.from, DAYS]));
const segs = segments(split.headcount);
const shareOf = (i: number) => Math.round(split.shares[i] / 1000) * 1000;
const share = shareOf(people.findIndex((p) => p.me));

function CountUp({ to }: { to: number }) {
  const v = useMotionValue(0);
  const text = useTransform(v, (x) => vnd(x));
  useEffect(() => { const c = animate(v, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1] }); return c.stop; }, [to, v]);
  return <motion.span>{text}</motion.span>;
}

export default function MyHome() {
  const [paid, setPaid] = useState(false);
  const paidCount = 1 + (paid ? 1 : 0);
  const C = 2 * Math.PI * 52;
  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Phòng 402 · The Fern House · Bình Thạnh</div>
      <h1 className="cx-serif cx-h2">Kỳ tháng 10, <em>gọn gàng</em> và minh bạch.</h1>

      <div className="cx-home">
        <motion.article className="cx-bill" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="cx-bill-top">
            <div>
              <span className="cx-meta !text-white/60">Phần của bạn</span>
              <div className="cx-bill-amount"><CountUp to={share} /></div>
              <span className="text-sm text-white/60">Hạn thanh toán {toVNTime("2026-10-10T16:59:00Z", true)}</span>
            </div>
            <div className="cx-ring">
              <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" className="track" /><motion.circle cx="60" cy="60" r="52" className="bar" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - paidCount / people.length) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} /></svg>
              <div><b>{paidCount}/{people.length}</b><small>đã trả</small></div>
            </div>
          </div>
          <motion.button className="cx-pay" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setPaid(true)} disabled={paid}>
            {paid ? <><Icon name="check" size={18} /> Đã thanh toán, cảm ơn bạn!</> : <>Thanh toán {vnd(share)} <Icon name="arrow" size={18} /></>}
          </motion.button>
        </motion.article>

        <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <h3 className="cx-panel-title">Tổng hóa đơn phòng</h3>
          {items.map(([k, v], i) => (
            <motion.div key={k} className="cx-line" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.07 }}><span>{k}</span><b>{vnd(v)}</b></motion.div>
          ))}
          <div className="cx-line total"><span>Tổng</span><b>{vnd(total)}</b></div>
          <h3 className="cx-panel-title mt-7">Chia theo từng ngày có mặt</h3>
          <div className="cx-formula">
            Mỗi ngày: {vnd(total)} ÷ {DAYS} ngày ≈ <b>{vnd(split.daily)}</b>, chia đều cho số người có mặt hôm đó.<br />
            {segs.map((g) => <span key={g.from} className="block">Ngày {g.from}–{g.to}: {g.n} người → mỗi người {vnd(split.daily / g.n)}/ngày</span>)}
          </div>
          {people.map((p, pi) => {
            const ok = p.me ? paid : p.paid;
            return (
              <div key={p.name} className="cx-person !block">
                <div className="flex items-center gap-3">
                  <span className="cx-av">{p.name.split(" ").pop()![0]}</span>
                  <span className="flex-1">{p.name}{p.me && <em className="cx-you">bạn</em>}<small className="block text-[#6b777d]">{p.days}/{DAYS} ngày · từ {String(p.from).padStart(2, "0")}/10</small></span>
                  <b>{vnd(shareOf(pi))}</b>
                  <motion.span className={`cx-status ${ok ? "ok" : ""}`} layout>{ok ? "Đã trả" : "Chưa trả"}</motion.span>
                </div>
                <div className="cx-daybar" title={`${p.days} ngày`}>
                  {Array.from({ length: DAYS }, (_, d) => (
                    <motion.span key={d} className={`${d + 1 >= p.from ? "on" : ""} ${p.me ? "me" : ""}`} initial={{ opacity: 0, scaleY: 0.3 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ delay: 0.3 + pi * 0.2 + d * 0.012 }} />
                  ))}
                </div>
              </div>
            );
          })}
        </motion.article>

      </div>
      <HomeExtras people={people.map((p) => p.name)} />
    </section>
  );
}
