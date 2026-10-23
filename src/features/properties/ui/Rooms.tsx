import { Icon, PageHead } from "@/shared/ui";

export default function Rooms() {
  return (
    <>
      <PageHead
        eyebrow="Khai thác"
        title="Phòng & Tin đăng"
        desc="Trạng thái từng phòng, sơ đồ tầng và tin đăng cho thuê tự động."
      />
      <div className="rounded-2xl border border-line bg-white p-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <Icon name="door" size={28} />
        </div>
        <h2 className="text-xl font-bold">Dịch vụ phòng &amp; tin đăng chưa được kết nối</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Các dịch vụ phụ trách gồm <code>property-service</code> (quản lý phòng, sơ đồ tầng, lịch sử giá) và <code>listing-booking-service</code> (đồng bộ tin đăng tự động theo sự kiện phòng trống) hiện chưa có mã nguồn trong kho backend.
          Tính năng sẽ được kết nối sau khi các service này được đưa vào vận hành.
        </p>
      </div>
    </>
  );
}
