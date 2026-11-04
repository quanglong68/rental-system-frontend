/**
 * ID từ backend có thể là `number` (ID nhỏ) hoặc `string` (Snowflake > 2^53 được
 * serialize dạng chuỗi để không mất chính xác). Mọi so sánh/khóa phải dùng String().
 */
export type Id = string | number;

export const idStr = (id: Id | null | undefined): string => (id == null ? "" : String(id));

export const sameId = (a: Id | null | undefined, b: Id | null | undefined): boolean =>
  a != null && b != null && String(a) === String(b);

/** Đọc ID người dùng nhập; giữ nguyên chuỗi để gửi lại backend dưới dạng Long. */
export const readId = (raw: string): Id | undefined => {
  const value = raw.trim();
  return value === "" ? undefined : value;
};
