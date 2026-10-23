import { Icon, PageHead } from "@/shared/ui";

/**
 * Chưa có dịch vụ hóa đơn public: api-gateway có route `/api/v1/invoices/**` nhưng
 * `billing-utility-service` chưa tồn tại trong repo (và chưa chạy). Không dựng dữ liệu giả.
 */
export default function Finance() {
  return (
    <>
      <PageHead
        eyebrow="Tài chính"
        title="Tài chính & Hóa đơn"
        desc="Hóa đơn phòng, công nợ và bảng giá dịch vụ sẽ hiển thị tại đây khi dịch vụ hóa đơn được kết nối."
      />
      <article className="panel">
        <div className="p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eef1ef] text-muted"><Icon name="wallet" size={22} /></span>
          <h2 className="mt-4 text-base font-extrabold">Dịch vụ hóa đơn chưa được kết nối</h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-muted">
            Chưa có endpoint hóa đơn/thanh toán công khai, nên tạm thời chưa thể xem hay thu tiền hóa đơn.
            Khi backend bổ sung, danh sách hóa đơn, chi tiết, công nợ và bảng giá dịch vụ sẽ quay lại đây.
          </p>
        </div>
      </article>
    </>
  );
}
