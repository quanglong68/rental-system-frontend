import { Icon, PageHead } from "@/shared/ui";

export default function Reports() {
  return (
    <>
      <PageHead
        eyebrow="Phân tích"
        title="Báo cáo"
        desc="Doanh thu, chi phí và lợi nhuận toàn hệ thống."
      />
      <div className="rounded-2xl border border-line bg-white p-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <Icon name="chart" size={28} />
        </div>
        <h2 className="text-xl font-bold">Dịch vụ báo cáo tài chính chưa được kết nối</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Dữ liệu tổng hợp doanh thu và lợi nhuận phụ thuộc trực tiếp vào dịch vụ hóa đơn &amp; thanh toán (<code>billing-utility-service</code> tại port 8086).
          Dữ liệu thống kê thực tế sẽ được hiển thị khi dịch vụ tài chính hoạt động.
        </p>
      </div>
    </>
  );
}
