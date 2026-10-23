import { Icon, PageHead } from "@/shared/ui";

export default function SalePipeline() {
  return (
    <>
      <PageHead
        eyebrow="SALE · Khách tiềm năng"
        title="Khách tiềm năng"
        desc="Theo dõi khách quan tâm từ tin đăng tự động và đặt lịch xem phòng."
      />
      <div className="rounded-2xl border border-line bg-white p-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <Icon name="users" size={28} />
        </div>
        <h2 className="text-xl font-bold">Dịch vụ quản lý khách tiềm năng chưa được kết nối</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Quy trình quản lý khách tiềm năng và xử lý yêu cầu xem phòng phụ thuộc vào <code>listing-booking-service</code> (port 8084). Service này hiện chưa được triển khai trong hệ thống backend.
        </p>
      </div>
    </>
  );
}
