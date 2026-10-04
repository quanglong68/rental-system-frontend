import { useState } from "react";
import { Icon, PageHead, Pill, Tabs, Toolbar, vnd } from "../ui";

const tenants = [
  { name: "Hoàng Thị Mai", phone: "0903 218 447", room: "A.402", building: "Fern House", since: "01/2026", debt: 0, verified: true },
  { name: "Trịnh Gia Huy", phone: "0938 772 105", room: "C.201", building: "Mộc Residence", since: "11/2025", debt: 1856000, verified: true },
  { name: "Nguyễn Lam", phone: "0912 004 931", room: "B.305", building: "Fern House", since: "10/2026", debt: 4442000, verified: false },
  { name: "Phan Hải Yến", phone: "0977 650 218", room: "A.108", building: "An Nhiên", since: "06/2025", debt: 0, verified: true },
];
const roommates = [
  { name: "Đặng Thu Trang", age: 24, job: "Nhân viên văn phòng", budget: 2500000, area: "Bình Thạnh", tags: ["Nữ", "Không hút thuốc", "Ngủ sớm"], match: 92 },
  { name: "Lê Hoàng Phúc", age: 21, job: "Sinh viên", budget: 1800000, area: "Thủ Đức", tags: ["Nam", "Nuôi mèo"], match: 78 },
  { name: "Võ Minh Thư", age: 27, job: "Designer", budget: 3000000, area: "Quận 3", tags: ["Nữ", "Làm việc tại nhà"], match: 85 },
];

export default function Tenants() {
  const [tab, setTab] = useState("Khách thuê");
  return (
    <>
      <PageHead eyebrow="Cộng đồng cư dân" title="Khách thuê & Ở ghép" desc="Hồ sơ CUSTOMER, xác minh danh tính và ghép bạn cùng phòng dựa trên ngân sách, khu vực và thói quen sinh hoạt."
        actions={<Tabs items={["Khách thuê", "Tìm người ở ghép"]} value={tab} onChange={setTab} />} />
      {tab === "Khách thuê" ? (
        <article className="panel">
          <Toolbar placeholder="Tìm tên, số điện thoại..."><button className="secondary-button !h-9"><Icon name="filter" size={15} /> Còn nợ</button></Toolbar>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Khách thuê</th><th>Phòng</th><th>Thuê từ</th><th>Xác minh</th><th className="text-right">Công nợ</th></tr></thead>
              <tbody>{tenants.map((t) => (
                <tr key={t.name}>
                  <td><div className="flex items-center gap-3"><span className="avatar-chip !h-9 !w-9">{t.name.split(" ").pop()![0]}</span><div><b>{t.name}</b><div className="sub">{t.phone}</div></div></div></td>
                  <td className="text-[13px]"><b>{t.room}</b> · {t.building}</td>
                  <td className="text-[13px]">{t.since}</td>
                  <td>{t.verified ? <Pill tone="teal">Đã xác minh CCCD</Pill> : <Pill tone="amber">Chờ xác minh</Pill>}</td>
                  <td className={`text-right font-bold ${t.debt ? "text-coral" : "text-muted"}`}>{t.debt ? vnd(t.debt) : "—"}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </article>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {roommates.map((r) => (
            <article key={r.name} className="panel p-5">
              <div className="flex items-center gap-3"><span className="avatar-chip !h-12 !w-12 !text-base">{r.name.split(" ").pop()![0]}</span><div className="flex-1"><b>{r.name}</b><div className="sub">{r.age} tuổi · {r.job}</div></div>
                <div className="match-ring" style={{ ["--p" as string]: `${r.match}%` }}><span>{r.match}%</span></div></div>
              <div className="mt-4 flex flex-wrap gap-1.5">{r.tags.map((t) => <Pill key={t}>{t}</Pill>)}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 text-xs"><div><div className="text-muted">Ngân sách</div><b>{vnd(r.budget)}</b></div><div><div className="text-muted">Khu vực</div><b>{r.area}</b></div></div>
              <button className="primary-button mt-4 w-full !h-10">Gợi ý phòng phù hợp</button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
