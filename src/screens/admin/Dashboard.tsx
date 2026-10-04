import { useState } from "react";
import { Icon } from "../../components/ui";

const activities = [
  { initials: "HT", color: "bg-amber-100 text-amber-700", name: "Hoàng Thị Mai", action: "đã thanh toán hóa đơn", detail: "HĐ-0425 · 3.650.000 ₫", time: "10 phút trước" },
  { initials: "KT", color: "bg-sky-100 text-sky-700", name: "Kỹ thuật viên Minh", action: "đã hoàn tất phiếu sửa chữa", detail: "Máy lạnh phòng A.402", time: "42 phút trước" },
  { initials: "NL", color: "bg-violet-100 text-violet-700", name: "Nguyễn Lam", action: "gửi yêu cầu thuê phòng", detail: "Phòng B.305 · The Fern House", time: "1 giờ trước" },
  { initials: "HN", color: "bg-emerald-100 text-emerald-700", name: "Hệ thống", action: "đã tạo tin đăng tự động", detail: "Phòng C.201 chuyển sang sắp trống", time: "2 giờ trước" },
];

const buildings = [
  { name: "The Fern House", location: "Bình Thạnh, TP.HCM", occupancy: 92, rooms: "46/50", revenue: "186,4 tr", image: "https://images.unsplash.com/photo-1762792013200-d474b123e1b8?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=700" },
  { name: "Căn hộ An Nhiên", location: "Quận 7, TP.HCM", occupancy: 86, rooms: "31/36", revenue: "142,8 tr", image: "https://images.unsplash.com/photo-1737737149038-e6532662659e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=700" },
];

export default function Dashboard({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [period, setPeriod] = useState("6 tháng");
  return (
    <>
          <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-teal"><span className="h-2 w-2 rounded-full bg-lime ring-4 ring-lime/20"></span> Hệ thống đang hoạt động ổn định</div>
              <h1 className="page-title">Chào buổi sáng, Minh Anh.</h1>
              <p className="mt-2 text-sm text-muted md:text-base">Đây là tình hình vận hành danh mục bất động sản của bạn hôm nay.</p>
            </div>
            <div className="flex gap-2">
              <button className="secondary-button"><Icon name="calendar" size={17} /> 01/05 — 31/05</button>
              <button className="primary-button"><Icon name="plus" size={17} /> Tạo mới</button>
            </div>
          </section>

          <section className="stats-grid">
            <article className="stat-card">
              <div className="flex items-start justify-between"><span className="stat-label">Tổng doanh thu</span><span className="trend-up"><Icon name="trend" size={13} /> 12,8%</span></div>
              <div className="stat-value">486,2 <small>triệu</small></div>
              <div className="stat-foot"><span className="dot bg-teal"></span>So với 431,1 triệu tháng trước</div>
            </article>
            <article className="stat-card">
              <div className="flex items-start justify-between"><span className="stat-label">Tỷ lệ lấp đầy</span><span className="trend-up"><Icon name="trend" size={13} /> 3,2%</span></div>
              <div className="stat-value">89,4<small>%</small></div>
              <div className="progress-track"><div className="w-[89.4%]"></div></div>
              <div className="stat-foot">118 / 132 phòng đang có khách</div>
            </article>
            <article className="stat-card">
              <div className="flex items-start justify-between"><span className="stat-label">Công nợ tháng này</span><span className="status-pill amber">12 hóa đơn</span></div>
              <div className="stat-value">42,8 <small>triệu</small></div>
              <div className="stat-foot"><span className="dot bg-amber-400"></span>8 hóa đơn sắp quá hạn</div>
            </article>
            <article className="stat-card">
              <div className="flex items-start justify-between"><span className="stat-label">Yêu cầu chờ xử lý</span><span className="status-pill coral">Cần chú ý</span></div>
              <div className="stat-value">17</div>
              <div className="stat-foot"><span className="dot bg-coral"></span>5 bảo trì · 8 thuê phòng · 4 khác</div>
            </article>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <article className="panel min-w-0">
              <div className="panel-header">
                <div><h2>Hiệu quả doanh thu</h2><p>Doanh thu thực nhận theo tháng</p></div>
                <div className="segmented">
                  {["6 tháng", "Năm nay"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={period === item ? "selected" : ""}>{item}</button>)}
                </div>
              </div>
              <div className="chart-wrap">
                <div className="chart-y"><span>600 tr</span><span>450 tr</span><span>300 tr</span><span>150 tr</span><span>0</span></div>
                <div className="chart">
                  <div className="chart-line l1"></div><div className="chart-line l2"></div><div className="chart-line l3"></div><div className="chart-line l4"></div>
                  <svg viewBox="0 0 700 240" preserveAspectRatio="none" aria-label="Biểu đồ doanh thu">
                    <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#16796f" stopOpacity=".22" /><stop offset="1" stopColor="#16796f" stopOpacity="0" /></linearGradient></defs>
                    <path d="M0 190 C70 174 80 130 140 145 S220 105 280 118 S365 62 420 82 S510 65 560 72 S640 22 700 36 L700 240 L0 240Z" fill="url(#area)" />
                    <path d="M0 190 C70 174 80 130 140 145 S220 105 280 118 S365 62 420 82 S510 65 560 72 S640 22 700 36" fill="none" stroke="#16796f" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                    <circle cx="700" cy="36" r="6" fill="#fff" stroke="#16796f" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <div className="chart-x"><span>Thg 12</span><span>Thg 1</span><span>Thg 2</span><span>Thg 3</span><span>Thg 4</span><span>Thg 5</span></div>
                </div>
              </div>
              <div className="chart-summary"><div><span className="legend-dot"></span><span>Doanh thu tháng 5</span></div><b>486.200.000 ₫</b><span className="trend-up">+12,8%</span></div>
            </article>

            <article className="panel">
              <div className="panel-header"><div><h2>Hoạt động gần đây</h2><p>Cập nhật trên toàn hệ thống</p></div><button className="text-button">Xem tất cả <Icon name="arrow" size={15} /></button></div>
              <div className="activity-list">
                {activities.map((a) => (
                  <div className="activity" key={a.detail}>
                    <div className={`activity-avatar ${a.color}`}>{a.initials}</div>
                    <div className="min-w-0 flex-1"><div className="text-[13px] leading-5"><b>{a.name}</b> <span className="text-muted">{a.action}</span></div><div className="mt-0.5 truncate text-xs font-semibold">{a.detail}</div><div className="mt-1 text-[11px] text-muted">{a.time}</div></div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-6 panel">
            <div className="panel-header"><div><h2>Tình hình tòa nhà</h2><p>Tỷ lệ lấp đầy và doanh thu tháng 5</p></div><button className="text-button" onClick={() => onNavigate("Tòa nhà")}>Quản lý tòa nhà <Icon name="arrow" size={15} /></button></div>
            <div className="building-grid">
              {buildings.map((building) => (
                <article className="building-card" key={building.name}>
                  <img src={building.image} alt={`Không gian ${building.name}`} />
                  <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                    <div><div className="flex justify-between gap-2"><h3>{building.name}</h3><button aria-label="Tùy chọn"><Icon name="more" size={18} /></button></div><div className="mt-1 flex items-center gap-1 text-xs text-muted"><Icon name="pin" size={13} />{building.location}</div></div>
                    <div>
                      <div className="mb-2 mt-4 flex items-end justify-between"><span className="text-xs font-semibold text-muted">Lấp đầy</span><b className="text-sm">{building.occupancy}% <small className="font-medium text-muted">({building.rooms})</small></b></div>
                      <div className="progress-track"><div style={{ width: `${building.occupancy}%` }}></div></div>
                      <div className="mt-3 flex justify-between border-t border-line pt-3 text-xs"><span className="text-muted">Doanh thu tháng</span><b>{building.revenue}</b></div>
                    </div>
                  </div>
                </article>
              ))}
              <button className="add-building"><span><Icon name="plus" size={20} /></span><b>Thêm tòa nhà</b><small>Mở rộng danh mục quản lý</small></button>
            </div>
          </section>
    </>
  );
}
