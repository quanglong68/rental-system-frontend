import { Icon } from "@/shared/ui";

export default function Requests() {
  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Yêu cầu thuê · Lịch xem phòng</div>
      <h1 className="cx-serif cx-h2">
        Những căn phòng <em>đang chờ</em> bạn.
      </h1>
      <div className="mt-8 rounded-2xl border border-line bg-white p-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <Icon name="calendar" size={28} />
        </div>
        <h2 className="text-xl font-bold">Dịch vụ đặt lịch &amp; yêu cầu thuê chưa được kết nối</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Dịch vụ tiếp nhận yêu cầu thuê và đặt lịch xem phòng (<code>listing-booking-service</code> tại cổng 8084) hiện chưa được triển khai mã nguồn trên máy chủ.
          Tính năng đặt lịch và theo dõi lịch hẹn xem phòng sẽ sẵn sàng khi dịch vụ được kích hoạt.
        </p>
      </div>
    </section>
  );
}
