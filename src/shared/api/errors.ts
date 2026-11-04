import { ApiError } from "./httpClient";

/**
 * Tiêu đề thân thiện cho các mã lỗi hay gặp. Nội dung chi tiết vẫn lấy từ
 * `message` do backend trả về (đã là tiếng Việt); mã kỹ thuật chỉ dùng cho
 * phần "Chi tiết" và không hiển thị trực tiếp cho người dùng.
 */
const titles: Record<string, string> = {
  CONTRACT_INCOMPLETE: "Hợp đồng chưa đủ thông tin bắt buộc (thiếu ngày kết thúc hoặc tiền cọc/giá thuê)",
  CONTRACT_SIGNATURE_REQUIRED: "Hợp đồng bắt buộc phải ký điện tử đủ 2 bên trước khi kích hoạt",
  CONTRACT_SIGNATURE_EXPIRED: "Đã quá thời hạn ký hợp đồng điện tử",
  ALREADY_SIGNED: "Bạn đã ký xác nhận hợp đồng này rồi",
  INVALID_SIGNATURE_STATUS: "Hợp đồng chưa sẵn sàng để thực hiện bước ký này",
  WRONG_PASSWORD: "Mật khẩu xác nhận chữ ký không chính xác, vui lòng thử lại",
  ROOM_ALREADY_CONTRACTED: "Phòng đã có hợp đồng thuê khác có hiệu lực trong khoảng thời gian này",
  CUSTOMER_ALREADY_IN_ROOM: "Người thuê đã thuộc một hợp đồng phòng khác đang có hiệu lực",
  NOT_REPRESENTATIVE: "Chỉ người đại diện đứng tên chính mới có quyền thực hiện thao tác này",
  LAST_TENANT: "Không thể xóa người ở cuối cùng khỏi hợp đồng",
  STAFF_NOT_IN_BUILDING: "Nhân viên chưa được phân công phụ trách tòa nhà của phòng này",
  INVALID_STATUS: "Trạng thái hiện tại của hồ sơ không cho phép thực hiện thao tác này",
  INVALID_DATE: "Ngày tháng không hợp lệ hoặc nằm ngoài khoảng thời gian cho phép",
  LISTING_NOT_ACTIVE: "Tin đăng phòng hiện đã đóng hoặc không còn nhận yêu cầu",
  LISTING_TERMS_INCOMPLETE: "Tin đăng phòng chưa hoàn thiện đủ điều khoản hợp đồng (tiền cọc, điện, nước...)",
  TERMS_NOT_ACCEPTED: "Vui lòng đọc và tích chọn đồng ý các điều khoản hợp đồng trước khi gửi",
  INVALID_MOVE_IN_DATE: "Ngày chuyển vào không hợp lệ (phải trong vòng 30 ngày kể từ ngày phòng sẵn sàng)",
  INVALID_IDENTITY_SIDE: "Mặt giấy tờ CCCD phải là mặt trước (FRONT) hoặc mặt sau (BACK)",
  ROOM_CAPACITY_EXCEEDED: "Phòng đã đủ số người ở theo sức chứa tối đa",
  ROOM_FULL: "Phòng đã đạt sức chứa tối đa, không thể nhận thêm người ở ghép",
  NO_ACTIVE_CONTRACT: "Phòng hiện chưa có hợp đồng thuê nào đang có hiệu lực",
  ALREADY_APPLIED: "Bạn đã gửi đơn ứng tuyển vào bài đăng này rồi",
  REQUEST_ALREADY_EXISTS: "Bạn đã có một yêu cầu đang được xử lý, vui lòng chờ kết quả",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này",
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
  VALIDATION_ERROR: "Thông tin nhập vào chưa hợp lệ, vui lòng kiểm tra lại các trường",
  NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu",
  CONFLICT: "Dữ liệu đã bị thay đổi bởi thao tác khác, vui lòng tải lại trang",
  DEPENDENCY_UNAVAILABLE: "Hệ thống máy chủ đang bận xử lý, vui lòng thử lại sau giây lát",
  REQUEST_TIMEOUT: "Máy chủ phản hồi quá lâu, vui lòng kiểm tra kết nối mạng",
  INTERNAL_ERROR: "Hệ thống gặp sự cố trong quá trình xử lý, vui lòng thử lại",
};

export type FriendlyError = {
  /** Tiêu đề ngắn, tiếng Việt, không chứa mã kỹ thuật. */
  title: string;
  /** Mô tả chi tiết (thường là message backend). */
  message: string;
  /** Mã kỹ thuật — chỉ dùng khi người dùng chủ động mở mục tra cứu kỹ thuật. */
  code?: string;
  traceId?: string;
  details?: { field: string; message: string }[];
};

function fallbackTitle(status?: number): string {
  if (status === 401) return titles.UNAUTHENTICATED;
  if (status === 403) return titles.FORBIDDEN;
  if (status === 404) return titles.NOT_FOUND;
  if (status === 409) return titles.CONFLICT;
  if (status && status >= 500) return titles.INTERNAL_ERROR;
  if (status === 400 || status === 422) return titles.VALIDATION_ERROR;
  return "Không thể hoàn tất thao tác";
}

export function formatApiError(error: unknown, fallback = "Đã xảy ra lỗi. Vui lòng thử lại."): FriendlyError {
  if (error instanceof ApiError) {
    const title = titles[error.code] ?? fallbackTitle(error.status);
    let message = error.message?.trim() || "";
    // Nếu message trả về trùng đúng mã kỹ thuật (ví dụ "CONTRACT_INCOMPLETE"), thay bằng title thân thiện
    if (!message || message === error.code || message === "UNPROCESSABLE_ENTITY") {
      message = title;
    }
    return {
      title,
      message: message || fallback,
      code: error.code,
      traceId: error.traceId,
      details: error.details,
    };
  }
  if (error instanceof Error) {
    return { title: "Không thể hoàn tất thao tác", message: error.message || fallback };
  }
  return { title: "Không thể hoàn tất thao tác", message: fallback };
}

/** Câu lỗi gọn để hiển thị trong toast/alert — không kèm mã kỹ thuật. */
export function errorText(error: unknown, fallback = "Đã xảy ra lỗi. Vui lòng thử lại."): string {
  const { title, message } = formatApiError(error, fallback);
  if (!message || message === fallback || message === title) return title;
  // Tránh lặp tiêu đề nếu backend đã trả câu bắt đầu giống tiêu đề.
  return message.startsWith(title) ? message : `${title}: ${message}`;
}

/** Dòng chi tiết kỹ thuật cho mục "Chi tiết" (chỉ hiện khi cần tra cứu lỗi). */
export function errorTechnical(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const parts: string[] = [];
  if (error.code) parts.push(`Mã lỗi: ${error.code}`);
  if (error.traceId) parts.push(`Mã tra soát: ${error.traceId}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

