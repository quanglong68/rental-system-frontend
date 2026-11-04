const VN_TZ = "Asia/Ho_Chi_Minh";

const timeFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TZ,
  day: "2-digit",
  month: "2-digit",
});

const fullDateFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Giờ nếu là hôm nay, ngày/tháng nếu khác — dùng cho danh sách hội thoại. */
export function shortChatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (dayKeyFmt.format(date) === dayKeyFmt.format(now)) return timeFmt.format(date);
  if (date.getFullYear() === now.getFullYear()) return dateFmt.format(date);
  return fullDateFmt.format(date);
}

export function chatClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : timeFmt.format(date);
}

export function dayKeyOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dayKeyFmt.format(date);
}

export function chatDayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const key = dayKeyFmt.format(date);
  const todayKey = dayKeyFmt.format(now);
  if (key === todayKey) return "Hôm nay";
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (key === dayKeyFmt.format(yesterday)) return "Hôm qua";
  return fullDateFmt.format(date);
}

export function lastSeenText(iso: string | null | undefined): string {
  if (!iso) return "Ngoại tuyến";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Ngoại tuyến";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Vừa hoạt động";
  if (diff < 3_600_000) return `Hoạt động ${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `Hoạt động ${Math.floor(diff / 3_600_000)} giờ trước`;
  return `Hoạt động ${fullDateFmt.format(date)}`;
}

/** So sánh ID dạng số lớn (Snowflake có thể vượt 2^53). */
export function idBigInt(id: string | number | null | undefined): bigint | null {
  if (id == null) return null;
  try {
    return BigInt(String(id));
  } catch {
    return null;
  }
}
