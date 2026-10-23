import { Icon, PageHead } from "@/shared/ui";

export default function Buildings() {
  return (
    <>
      <PageHead
        eyebrow="Danh mục tài sản"
        title="Tòa nhà"
        desc="Quản lý thông tin, tọa độ GPS và phân công nhân sự phụ trách từng tòa nhà."
      />
      <div className="rounded-2xl border border-line bg-white p-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <Icon name="building" size={28} />
        </div>
        <h2 className="text-xl font-bold">Dịch vụ quản lý tòa nhà chưa được kết nối</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          Dịch vụ bất động sản (<code>property-service</code> tại cổng 8083) phụ thuộc cơ sở dữ liệu PostGIS (với chỉ mục GIST và hàm địa lý ST_DWithin) hiện chưa có mã nguồn trong hệ thống backend.
          Tính năng quản lý danh mục tòa nhà, tọa độ GPS và phân công quản lý sẽ khả dụng khi dịch vụ được kích hoạt.
        </p>
      </div>
    </>
  );
}
