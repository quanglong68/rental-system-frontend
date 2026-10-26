import { Icon } from "@/shared/ui";

const REQUIRED_APIS = [
  "GET /api/v1/roommate-posts?buildingId=&roomId=",
  "GET /api/v1/roommate-posts/{id}",
  "POST /api/v1/roommate-applications",
  "GET /api/v1/roommate-applications/mine",
  "GET /api/v1/roommate-posts/{postId}/applications",
  "PUT /api/v1/roommate-applications/{id}/approve | /reject",
];

export default function Roommates() {
  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Cộng đồng cư dân · Tìm bạn cùng phòng</div>
      <h1 className="cx-serif cx-h2">
        Tìm người <em>hợp lối sống</em> cùng bạn.
      </h1>
      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-line bg-white p-8 text-center md:p-12">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <Icon name="users" size={28} />
        </div>
        <h2 className="text-xl font-bold">Dịch vụ tìm người ở ghép chưa được kết nối</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Tính năng đăng bài và duyệt hồ sơ ở ghép thuộc <code>listing-booking-service</code> tại cổng
          8084, hiện chưa có service backend hoạt động. Trang này không dùng dữ liệu giả hoặc nút duyệt
          cục bộ.
        </p>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-left">
          <p className="text-sm font-bold text-[#0e1a1f]">API tối thiểu cần bổ sung</p>
          <ul className="mt-3 space-y-2 text-left text-xs text-[#56636a]">
            {REQUIRED_APIS.map((api) => (
              <li key={api} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <code className="break-all">{api}</code>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-6 text-[#56636a]">
            Listing phải phát event <code>RoommateApplicationAccepted</code>; contract-tenant-service
            consume event này để thêm applicant vào hợp đồng <b>ACTIVE</b> của phòng sau khi kiểm tra sức
            chứa. Luồng này <b>không tạo hợp đồng DRAFT</b>. Khi API sẵn sàng, màn hình sẽ tải bài đăng
            thật, gửi hồ sơ và hiển thị trạng thái duyệt thay vì thông báo này.
          </p>
        </div>
      </div>
    </section>
  );
}
