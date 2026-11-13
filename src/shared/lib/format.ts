/**
 * Nhóm hàng nghìn bằng dấu chấm, không phụ thuộc dữ liệu locale của trình duyệt
 * (máy thiếu ICU khiến toLocaleString("vi-VN") trả dấu phẩy kiểu en-US).
 */
export const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Định dạng VND, giữ nguyên đơn vị đồng (không làm tròn giá điện/nước). */
export const vnd = (n: number) => `${groupThousands(String(Math.round(n)))} ₫`;

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
  const digits = String(val).replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return groupThousands(digits);
};

/** Lấy giá trị số nguyên từ chuỗi nhập tiền (ví dụ: "43.000" -> 43000) */
export const parseMoneyInput = (val: string | number | null | undefined): number => {
  if (val == null || val === "") return 0;
  const digits = String(val).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
};

/** Format "1.234.567" và trả caret mới nằm sau đúng số chữ số đã gõ trước đó. */
export const formatMoneyWithCaret = (raw: string, caret: number) => {
  const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const display = digits ? groupThousands(digits) : "";
  let pos = 0;
  for (let seen = 0; pos < display.length && seen < digitsBefore; pos++) {
    if (/\d/.test(display[pos])) seen++;
  }
  return { display, value: digits ? Number(digits) : 0, caret: pos };
};

