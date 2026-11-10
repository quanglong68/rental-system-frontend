import { useState } from "react";
import { Icon } from "@/shared/ui";
import { bookingApi } from "@/api/booking";
import { errorText } from "@/shared/api/errors";
import type { Id } from "@/shared/lib/id";

type Props = {
  open: boolean;
  room: {
    roomId: Id;
    code: string;
    building: string;
    address: string;
  };
  onClose: () => void;
  onBooked: (message: string) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const maxDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const TIME_SLOTS = ["09:00", "10:30", "14:00", "15:30", "17:00", "18:30"];

export default function AppointmentBookingModal({
  open,
  room,
  onClose,
  onBooked,
}: Props) {
  const [date, setDate] = useState(tomorrowStr);
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError("Vui lòng chọn ngày xem phòng.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const [year, month, day] = date.split("-").map(Number);
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const apptDate = new Date(year, month - 1, day, hours, minutes, 0);

      if (apptDate.getTime() <= Date.now()) {
        setError("Thời gian hẹn xem phòng phải ở trong tương lai.");
        setLoading(false);
        return;
      }

      await bookingApi.bookViewingAppointment({
        roomId: room.roomId,
        appointmentDate: apptDate.toISOString(),
      });

      onBooked(
        `Đã đặt lịch xem phòng ${room.code} (${room.building}) lúc ${selectedTime} ngày ${pad(day)}/${pad(month)}/${year}! Nhân viên kinh doanh sẽ liên hệ đón tiếp bạn.`
      );
      onClose();
    } catch (err) {
      setError(errorText(err, "Không thể đặt lịch xem phòng lúc này."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-surface/50 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-500/10 text-teal-700">
              <Icon name="calendar" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Đặt lịch hẹn xem phòng</h2>
              <p className="text-xs text-muted">
                Phòng {room.code} · {room.building}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-text"
            onClick={onClose}
            aria-label="Đóng"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 text-xs text-teal-800 leading-relaxed">
            <p className="font-semibold">Lưu ý về lịch xem phòng:</p>
            <p className="mt-0.5">
              • Lịch hẹn xem phòng hoàn toàn độc lập với yêu cầu thuê và không thu bất kỳ khoản phí nào.
            </p>
            <p className="mt-0.5">
              • Nhân viên kinh doanh phụ trách tòa nhà sẽ liên hệ xác nhận và dẫn bạn xem trực tiếp phòng tại{" "}
              <b>{room.address}</b>.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text uppercase tracking-wide">
              Ngày xem phòng <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-text shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              min={tomorrowStr()}
              max={maxDateStr()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text uppercase tracking-wide">
              Khung giờ hẹn <span className="text-red-500">*</span>
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    selectedTime === slot
                      ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                      : "border-line bg-white text-muted hover:border-teal-400 hover:text-text"
                  }`}
                  onClick={() => setSelectedTime(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text uppercase tracking-wide">
              Ghi chú thêm cho nhân viên đón tiếp (tùy chọn)
            </label>
            <textarea
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-line bg-white p-3 text-sm text-text shadow-sm placeholder:text-muted/60 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              placeholder="Ví dụ: Em muốn xem thêm khu vực để xe và máy giặt chung..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              className="cx-btn ghost !py-2 text-xs text-muted"
              onClick={onClose}
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="cx-btn primary !py-2 text-xs font-semibold"
              disabled={loading}
            >
              {loading ? "Đang đặt lịch…" : "Xác nhận đặt lịch xem"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
