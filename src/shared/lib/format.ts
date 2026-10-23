/** Làm tròn đến hàng nghìn và định dạng VND */
export const vnd = (n: number) => `${(Math.round(n / 1000) * 1000).toLocaleString("vi-VN")} ₫`;

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
