import { Icon } from "@/shared/ui";

export default function Roommates() {
  return (
    <section className="cx-section !pt-32">
      <div className="cx-eyebrow">Cộng đồng cư dân · Tìm bạn cùng phòng</div>
      <h1 className="cx-serif cx-h2">
        Tìm người <em>hợp lối sống</em> cùng bạn.
      </h1>
      <div className="mt-8 rounded-2xl border border-line bg-white p-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <Icon name="users" size={28} />
        </div>
        <h2 className="text-xl font-bold">Dịch vụ tìm người ở ghép chưa được kết nối</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Tính năng đăng bài và duyệt hồ sơ ở ghép (<code>roommate-posts</code> và <code>roommate-applications</code> thuộc <code>listing-booking-service</code> tại cổng 8084) hiện chưa có service backend hoạt động.
          Hệ thống sẽ cập nhật khi dịch vụ được phát hành.
        </p>
      </div>
    </section>
  );
}
