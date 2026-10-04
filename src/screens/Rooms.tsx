import { useState } from "react";
import { Drawer, Field, Icon, PageHead, Pill, Switch, Tabs, Toolbar, toVNTime, useToast, vnd, type Tone } from "../ui";

type Status = "Đang thuê" | "Trống" | "Sắp trống" | "Bảo trì" | "Ở ghép";
type Room = { code: string; status: Status; price: number; area: number; type: string; capacity: number };
const tone: Record<Status, Tone> = { "Đang thuê": "slate", Trống: "teal", "Sắp trống": "amber", "Bảo trì": "coral", "Ở ghép": "violet" };
const types = ["Phòng đơn", "Phòng đôi", "Studio", "Căn 1PN", "Ký túc xá"];
const initialFloors = [5, 4, 3, 2, 1].map((f) => ({
  floor: f,
  rooms: Array.from({ length: 8 }, (_, i): Room => {
    const s: Status[] = ["Đang thuê", "Đang thuê", "Ở ghép", "Đang thuê", "Trống", "Sắp trống", "Đang thuê", "Bảo trì"];
    return { code: `A.${f}0${i + 1}`, status: s[(i + f * 3) % 8], price: 3500000 + ((i + f) % 4) * 450000, area: 22 + ((i * 3) % 12), type: types[(i + f) % 4], capacity: 1 + ((i + f) % 3) };
  }),
}));
const priceHistory = [
  { from: "2026-07-01T00:00:00Z", price: 0, by: "Lê Quốc Bảo", note: "Điều chỉnh theo thị trường" },
  { from: "2026-01-01T00:00:00Z", price: -300000, by: "Trần Minh Anh", note: "Giá năm 2026" },
  { from: "2025-03-15T00:00:00Z", price: -500000, by: "Trần Minh Anh", note: "Giá khởi tạo" },
];
const initialListings = [
  { room: "C.201", building: "Mộc Residence", price: 4200000, views: 312, leads: 9, auto: true, on: true, reason: "Sắp trống từ 31/10", posted: "2026-10-02T03:15:00Z" },
  { room: "A.305", building: "The Fern House", price: 3950000, views: 188, leads: 5, auto: true, on: true, reason: "Phòng trống", posted: "2026-10-01T09:40:00Z" },
  { room: "B.104", building: "Căn hộ An Nhiên", price: 5100000, views: 96, leads: 2, auto: false, on: false, reason: "Đăng thủ công", posted: "2026-09-29T14:05:00Z" },
];
const staffList = ["Đinh Khánh Linh (SALE)", "Hồ Gia Bảo (SALE)", "Lê Quốc Bảo (QUAN_LY)"];
const initialRequests = [
  { id: 1, name: "Nguyễn Lam", phone: "0907665120", room: "C.201", wish: "2026-10-06T03:00:00Z", note: "Muốn xem phòng buổi sáng", status: "Chờ duyệt", staff: "" },
  { id: 2, name: "Phan Ngọc Hân", phone: "0909876543", room: "A.305", wish: "2026-10-05T11:30:00Z", note: "Đi cùng 1 bạn", status: "Đã hẹn", staff: "Đinh Khánh Linh (SALE)" },
  { id: 3, name: "Trương Quốc Việt", phone: "0933456789", room: "A.305", wish: "2026-10-07T09:00:00Z", note: "", status: "Chờ duyệt", staff: "" },
  { id: 4, name: "Mai Thảo Nhi", phone: "0868221190", room: "C.201", wish: "2026-10-03T02:00:00Z", note: "Khách hủy", status: "Đã hủy", staff: "" },
];
const reqTone: Record<string, Tone> = { "Chờ duyệt": "amber", "Đã hẹn": "sky", "Từ chối": "coral", "Đã hủy": "slate" };

export default function Rooms() {
  const [tab, setTab] = useState("Sơ đồ phòng");
  const [floors, setFloors] = useState(initialFloors);
  const [listings, setListings] = useState(initialListings);
  const [requests, setRequests] = useState(initialRequests);
  const [room, setRoom] = useState<Room | null>(null);
  const [adding, setAdding] = useState(false);
  const [schedule, setSchedule] = useState<(typeof initialRequests)[number] | null>(null);
  const [toast, show] = useToast();
  const setRoomStatus = (code: string, status: Status) => {
    setFloors(floors.map((f) => ({ ...f, rooms: f.rooms.map((r) => (r.code === code ? { ...r, status } : r)) })));
    setRoom((r) => (r ? { ...r, status } : r));
    show(status === "Bảo trì" ? `${code} chuyển sang Bảo trì · tin đăng tạm ẩn` : `${code} đã Trống · hệ thống tự đăng tin`);
  };
  const pending = requests.filter((r) => r.status === "Chờ duyệt").length;

  return (
    <>
      <PageHead eyebrow="Khai thác" title="Phòng & Tin đăng" desc="Trạng thái từng phòng, tin đăng và lịch xem phòng. Phòng Trống / Sắp trống được tự động đăng tin."
        actions={<><Tabs items={["Sơ đồ phòng", "Tin đăng", `Yêu cầu & Lịch hẹn (${pending})`]} value={tab.startsWith("Yêu cầu") ? `Yêu cầu & Lịch hẹn (${pending})` : tab} onChange={setTab} /><button className="primary-button" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Thêm phòng</button></>} />

      {tab === "Sơ đồ phòng" && (
        <article className="panel">
          <Toolbar placeholder="Tìm mã phòng..."><select className="select"><option>The Fern House</option><option>Căn hộ An Nhiên</option></select></Toolbar>
          <div className="flex flex-wrap gap-4 border-b border-line px-5 py-3">{(Object.keys(tone) as Status[]).map((s) => <span key={s} className="flex items-center gap-2 text-xs font-semibold text-muted"><span className={`dot dot-${tone[s]}`}></span>{s}</span>)}</div>
          <div className="space-y-3 overflow-x-auto p-5">
            {floors.map((f) => (
              <div key={f.floor} className="flex min-w-[760px] items-stretch gap-3">
                <div className="floor-label">Tầng {f.floor}</div>
                {f.rooms.map((r) => (
                  <button key={r.code} className={`room-tile room-${tone[r.status]}`} onClick={() => setRoom(r)}>
                    <b>{r.code}</b><span>{r.area} m² · {r.capacity}ng</span><small>{(r.price / 1e6).toLocaleString("vi-VN")} tr</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </article>
      )}

      {tab === "Tin đăng" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {listings.map((l) => (
            <article key={l.room} className={`panel p-5 transition-opacity ${l.on ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between"><Pill tone={l.auto ? "teal" : "slate"}>{l.auto ? "Đăng tự động" : "Đăng thủ công"}</Pill>
                <span className="flex items-center gap-2 text-xs font-bold">{l.on ? "Đang hiển thị" : "Đã ẩn"}<Switch on={l.on} label="Bật tin đăng" onChange={(v) => { setListings(listings.map((x) => (x.room === l.room ? { ...x, on: v } : x))); show(v ? `Đã bật tin phòng ${l.room}` : `Đã ẩn tin phòng ${l.room}`); }} /></span></div>
              <h3 className="mt-4 text-lg font-extrabold">Phòng {l.room}</h3>
              <div className="text-xs text-muted">{l.building} · {l.reason} · {toVNTime(l.posted)}</div>
              <div className="mt-4 text-2xl font-extrabold tracking-tight">{vnd(l.price)}<small className="text-xs font-semibold text-muted"> /tháng</small></div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 text-xs"><div><div className="text-muted">Lượt xem</div><b className="text-base">{l.views}</b></div><div><div className="text-muted">Yêu cầu thuê</div><b className="text-base">{l.leads}</b></div></div>
              <button className="primary-button mt-4 w-full !h-9" onClick={() => setTab("Yêu cầu")}>Xem yêu cầu</button>
            </article>
          ))}
        </div>
      )}

      {tab.startsWith("Yêu cầu") && (
        <article className="panel">
          <div className="panel-header"><div><h2>Yêu cầu thuê & lịch xem phòng</h2><p>Duyệt yêu cầu, chọn giờ hẹn và phân công nhân viên dẫn khách</p></div></div>
          {requests.map((r) => (
            <div key={r.id} className={`approval ${r.status === "Đã hủy" || r.status === "Từ chối" ? "approval-done" : ""}`}>
              <span className="avatar-chip !h-10 !w-10">{r.name.split(" ").pop()![0]}</span>
              <div className="min-w-[200px] flex-1"><b className="text-sm">{r.name}</b> <span className="text-xs text-muted">· {r.phone}</span><div className="text-xs text-muted">Phòng {r.room} · Muốn xem {toVNTime(r.wish, true)}{r.note && ` · “${r.note}”`}</div>{r.staff && <div className="mt-1 text-xs font-bold text-teal">Phụ trách: {r.staff}</div>}</div>
              <Pill tone={reqTone[r.status]}>{r.status}</Pill>
              {r.status === "Chờ duyệt" && <div className="flex gap-2"><button className="secondary-button !h-9" onClick={() => { setRequests(requests.map((x) => (x.id === r.id ? { ...x, status: "Từ chối" } : x))); show("Đã từ chối yêu cầu"); }}>Từ chối</button><button className="primary-button !h-9" onClick={() => setSchedule(r)}><Icon name="calendar" size={15} /> Duyệt & hẹn</button></div>}
              {r.status === "Đã hẹn" && <button className="secondary-button !h-9" onClick={() => setSchedule(r)}>Đổi lịch</button>}
            </div>
          ))}
        </article>
      )}

      <Drawer open={!!room} eyebrow={room ? `${room.type} · Tầng ${room.code[2]}` : ""} title={`Phòng ${room?.code ?? ""}`} onClose={() => setRoom(null)}
        footer={room && (room.status === "Bảo trì"
          ? <button className="primary-button" onClick={() => setRoomStatus(room.code, "Trống")}>Hoàn tất bảo trì → Trống</button>
          : room.status === "Trống" || room.status === "Sắp trống" ? <button className="danger-button" onClick={() => setRoomStatus(room.code, "Bảo trì")}><Icon name="tools" size={15} /> Chuyển sang Bảo trì</button> : <span className="mr-auto self-center text-xs text-muted">Phòng đang có hợp đồng, không thể chuyển bảo trì.</span>)}>
        {room && (
          <>
            <div className="mb-4 flex items-center gap-2"><Pill tone={tone[room.status]}>{room.status}</Pill>{(room.status === "Trống" || room.status === "Sắp trống") && <Pill tone="teal">Tin đăng tự động đang bật</Pill>}</div>
            <div className="form-grid">
              <Field label="Loại phòng"><select defaultValue={room.type}>{types.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Sức chứa tối đa" hint="Vượt quá sẽ báo ROOM_CAPACITY_EXCEEDED"><input type="number" min={1} defaultValue={room.capacity} /></Field>
              <Field label="Diện tích (m²)"><input type="number" defaultValue={room.area} /></Field>
              <Field label="Giá niêm yết (₫)" hint="Đổi giá sẽ tạo bản ghi lịch sử"><input defaultValue={room.price.toLocaleString("vi-VN")} /></Field>
            </div>
            <div className="section-title">Lịch sử giá</div>
            <div className="relative ml-1 border-l-2 border-line pl-5">
              {priceHistory.map((h, i) => (
                <div key={h.from} className="relative pb-4"><span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white ${i === 0 ? "bg-teal" : "bg-[#b9c9c3]"}`} />
                  <div className="flex justify-between text-sm"><b>{vnd(room.price + h.price)}</b><span className="text-xs text-muted">từ {toVNTime(h.from)}</span></div>
                  <div className="text-xs text-muted">{h.note} · {h.by}</div></div>
              ))}
            </div>
            <button className="secondary-button mt-2 w-full" onClick={() => show("Đã lưu thay đổi phòng")}>Lưu thay đổi</button>
          </>
        )}
      </Drawer>

      <Drawer open={adding} eyebrow="Danh mục" title="Thêm phòng" onClose={() => setAdding(false)}
        footer={<><button className="secondary-button" onClick={() => setAdding(false)}>Hủy</button><button className="primary-button" onClick={() => { setAdding(false); show("Đã thêm phòng A.509 · trạng thái Trống, tự động đăng tin"); }}>Tạo phòng</button></>}>
        <div className="form-grid">
          <Field label="Tòa nhà"><select><option>The Fern House</option><option>Căn hộ An Nhiên</option><option>Mộc Residence</option></select></Field>
          <Field label="Mã phòng"><input placeholder="A.509" /></Field>
          <Field label="Tầng"><input type="number" defaultValue={5} /></Field>
          <Field label="Loại phòng"><select>{types.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Diện tích (m²)"><input type="number" placeholder="25" /></Field>
          <Field label="Sức chứa tối đa"><input type="number" defaultValue={2} /></Field>
          <div className="span-2"><Field label="Giá niêm yết (₫/tháng)"><input placeholder="3.900.000" /></Field></div>
          <div className="span-2"><Field label="Tiện ích"><textarea placeholder="Ban công, máy lạnh, bếp riêng…" /></Field></div>
        </div>
      </Drawer>

      <Drawer open={!!schedule} eyebrow={schedule ? `${schedule.name} · Phòng ${schedule.room}` : ""} title="Lên lịch xem phòng" onClose={() => setSchedule(null)}
        footer={<><button className="secondary-button" onClick={() => setSchedule(null)}>Hủy</button><button className="primary-button" onClick={() => { setRequests(requests.map((x) => (x.id === schedule!.id ? { ...x, status: "Đã hẹn", staff: x.staff || staffList[0] } : x))); setSchedule(null); show("Đã gửi lịch hẹn cho khách qua thông báo"); }}>Xác nhận lịch</button></>}>
        {schedule && (
          <div className="form-grid">
            <Field label="Ngày"><input type="date" defaultValue={schedule.wish.slice(0, 10)} /></Field>
            <Field label="Giờ (UTC+7)"><select defaultValue="10:00">{["08:30", "10:00", "14:00", "16:30", "18:30"].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <div className="span-2"><Field label="Nhân viên dẫn xem"><select defaultValue={schedule.staff || staffList[0]} onChange={(e) => setSchedule({ ...schedule, staff: e.target.value })}>{staffList.map((s) => <option key={s}>{s}</option>)}</select></Field></div>
            <div className="span-2"><Field label="Ghi chú cho khách"><textarea defaultValue="Vui lòng gọi trước 15 phút khi tới. Gửi xe tại tầng hầm B1." /></Field></div>
          </div>
        )}
      </Drawer>
      {toast}
    </>
  );
}
