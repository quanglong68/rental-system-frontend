import { useEffect, useState } from "react";
import { Icon } from "@/shared/ui";
import { HomeExtras } from "./MyHomeExtras";

export default function MyHome() {
  const [activeTab, setActiveTab] = useState<"billing" | "contracts" | "roommates">("billing");

  useEffect(() => {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    if (hash === "#contract-signing-section" || urlParams.get("action") === "sign" || urlParams.get("tab") === "contracts") {
      setActiveTab("contracts");
    } else if (urlParams.get("tab") === "roommates") {
      setActiveTab("roommates");
    }
  }, []);

  return (
    <section className="cx-section !pt-32">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="cx-eyebrow">Khu vực cư dân · Quản lý phòng & Dịch vụ</div>
          <h1 className="cx-serif cx-h2">
            Căn phòng của bạn, <em>minh bạch</em> & trọn vẹn.
          </h1>
          <p className="mt-2 text-sm text-muted max-w-xl">
            Tách biệt rõ ràng thu chi hóa đơn, hợp đồng pháp lý và quản lý bạn ở ghép cùng phòng.
          </p>
        </div>
      </div>

      {/* Thanh Tabs Điều Hướng Cấp Cao Nhất Tách Biệt Hóa Đơn - Hợp Đồng - Ở Ghép */}
      <div className="mt-8 flex flex-wrap gap-3 border-b border-line pb-4">
        <button
          type="button"
          className={`cx-chip !py-2.5 !px-5 text-sm flex items-center gap-2 font-bold ${
            activeTab === "billing" ? "on !bg-teal-700 !text-white !border-teal-700 shadow-sm" : ""
          }`}
          onClick={() => setActiveTab("billing")}
        >
          <Icon name="check" size={16} /> 1. Hóa đơn & Thu chi phòng
        </button>

        <button
          type="button"
          className={`cx-chip !py-2.5 !px-5 text-sm flex items-center gap-2 font-bold ${
            activeTab === "contracts" ? "on !bg-teal-700 !text-white !border-teal-700 shadow-sm" : ""
          }`}
          onClick={() => setActiveTab("contracts")}
        >
          <Icon name="search" size={16} /> 2. Hợp đồng & Thành viên
        </button>

        <button
          type="button"
          className={`cx-chip !py-2.5 !px-5 text-sm flex items-center gap-2 font-bold ${
            activeTab === "roommates" ? "on !bg-teal-700 !text-white !border-teal-700 shadow-sm" : ""
          }`}
          onClick={() => setActiveTab("roommates")}
        >
          <Icon name="users" size={16} /> 3. Ở ghép phòng tôi
        </button>
      </div>

      {/* Nội Dung Từng Tab Toàn Chiều Rộng, Không Bị Chèn Ép Cột Hẹp */}
      <HomeExtras activeTab={activeTab} onTabChange={setActiveTab} />
    </section>
  );
}
