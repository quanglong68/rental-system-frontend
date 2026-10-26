import { motion } from "motion/react";
import { Icon } from "@/shared/ui";
import { HomeExtras } from "./MyHomeExtras";

export default function MyHome() {
  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Khu vực khách thuê</div>
      <h1 className="cx-serif cx-h2">Hóa đơn của bạn, <em>minh bạch</em> và gọn gàng.</h1>

      <div className="cx-home">
        <motion.article className="cx-bill" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="cx-bill-top">
            <div>
              <span className="cx-meta !text-white/60">Kỳ thanh toán</span>
              <div className="mt-3 max-w-[320px] text-sm leading-6 text-white/70">
                Số tiền, hạn thanh toán và trạng thái thanh toán sẽ hiển thị ở đây khi dịch vụ hóa đơn được kết nối.
              </div>
            </div>
          </div>
          <div className="cx-btn ghost !cursor-default opacity-60" aria-disabled="true">
            <Icon name="clock" size={18} /> Dữ liệu hóa đơn chưa được kết nối
          </div>
        </motion.article>

        <motion.article className="cx-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <h3 className="cx-panel-title">Chi tiết hóa đơn</h3>
          <div className="alert alert-info">
            Chưa có kết nối tới dịch vụ hóa đơn, nên chưa thể hiển thị tiền phòng, điện, nước, dịch vụ hay số tiền phải trả.
          </div>
        </motion.article>
      </div>

      <HomeExtras />
    </section>
  );
}
