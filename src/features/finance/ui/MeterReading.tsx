import { Icon, PageHead } from "@/shared/ui";

/**
 * Chưa có backend billing-utility-service hoạt động: gateway có cấu hình route
 * meter-reading nhưng service chưa tồn tại trong repo. Không dùng dữ liệu/hành động giả.
 */
export default function MeterReading() {
  return (
    <>
      <PageHead
        eyebrow="Tài chính"
        title="Chốt chỉ số điện nước"
        desc="Tính năng chốt chỉ số điện, nước hiện chưa khả dụng do dịch vụ chưa được kết nối."
      />
      <article className="panel">
        <div className="p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eef1ef] text-muted">
            <Icon name="tools" size={22} />
          </span>
          <h2 className="mt-4 text-base font-extrabold">Dịch vụ chốt chỉ số chưa được kết nối</h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-muted">
            Chưa có endpoint quản lý đồng hồ và chốt chỉ số điện nước công khai từ backend.
            Khi dịch vụ hoàn thiện và kết nối, danh sách phòng, chỉ số kỳ trước và chức năng chốt số sẽ khả dụng tại đây.
          </p>
        </div>
      </article>
    </>
  );
}
