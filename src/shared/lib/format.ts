/** Định dạng VND, giữ nguyên đơn vị đồng (không làm tròn giá điện/nước). */
export const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} ₫`;

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD (không phụ thuộc múi giờ máy người dùng). */
export const todayVN = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

/** Chuyển chuỗi thời gian UTC từ backend sang UTC+7 */
export const toVNTime = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

/** Định dạng số tiền có phân cách hàng nghìn bằng dấu chấm (ví dụ: 43000 -> "43.000") */
export const formatMoneyInput = (val: string | number | null | undefined): string => {
  if (val == null || val === "") return "";
  const digits = String(val).replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
};

/** Lấy giá trị số nguyên từ chuỗi nhập tiền (ví dụ: "43.000" -> 43000) */
export const parseMoneyInput = (val: string | number | null | undefined): number => {
  if (val == null || val === "") return 0;
  const digits = String(val).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
};

