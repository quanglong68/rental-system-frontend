/** Làm tròn đến hàng nghìn và định dạng VND */
export const vnd = (n: number) => `${(Math.round(n / 1000) * 1000).toLocaleString("vi-VN")} ₫`;

/** Chuyển chuỗi thời gian UTC từ backend sang UTC+7 */
export const toVNTime = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
