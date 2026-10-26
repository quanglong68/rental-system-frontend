import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "@/features/auth";
import { ApiError } from "@/shared/api/httpClient";
import { Field, Icon, PageHead } from "@/shared/ui";
import { propertyApi, type BuildingSearchResult, type Room } from "@/features/properties/api/propertyApi";
import { contractsApi, type CreateDraftManualRequest } from "@/features/contracts/api/contractsApi";

const errText = (e: unknown) =>
  e instanceof ApiError ? `${e.code} · ${e.message}` : e instanceof Error ? e.message : "Đã xảy ra lỗi.";

type FormState = {
  customerId: string;
  buildingId: string;
  roomId: string;
  startDate: string;
  rentAmount: string;
};

const emptyForm: FormState = {
  customerId: "",
  buildingId: "",
  roomId: "",
  startDate: "",
  rentAmount: "",
};

export default function CreateDraftContractPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Authorization guard
  if (
    !user ||
    (!user.roles.includes("SALE") &&
      !user.roles.includes("QUAN_LY") &&
      !user.roles.includes("ADMIN"))
  ) {
    return <Navigate to="/admin/contracts" replace />;
  }

  const [form, setForm] = useState<FormState>(emptyForm);

  const [buildings, setBuildings] = useState<BuildingSearchResult[]>([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);
  const [buildingsError, setBuildingsError] = useState("");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Load buildings once on mount
  useEffect(() => {
    let cancelled = false;
    setBuildingsLoading(true);
    setBuildingsError("");
    propertyApi
      .buildings(0, 100, "", "", "", "name,asc")
      .then((page) => {
        if (!cancelled) {
          setBuildings(page.content);
          setBuildingsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setBuildingsError(errText(err));
          setBuildingsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load rooms when buildingId changes — with AbortController to prevent stale responses
  useEffect(() => {
    setRooms([]);
    setForm((f) => ({ ...f, roomId: "" }));
    setRoomsError(null);

    if (!form.buildingId) return;

    setRoomsLoading(true);
    const controller = new AbortController();

    propertyApi
      .rooms(form.buildingId, 0, "roomCode,asc", controller.signal)
      .then((page) => {
        setRooms(page.content.filter((r) => r.status === "VACANT"));
        setRoomsLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setRoomsError(errText(err));
        setRoomsLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.buildingId]);

  const customerIdNum = Number(form.customerId);
  const rentAmountNum = Number(form.rentAmount);

  const isValid =
    form.customerId.trim() !== "" &&
    Number.isInteger(customerIdNum) &&
    customerIdNum > 0 &&
    form.buildingId !== "" &&
    form.roomId !== "" &&
    rooms.some((r) => r.id === form.roomId) &&
    form.startDate !== "" &&
    form.rentAmount.trim() !== "" &&
    Number.isInteger(rentAmountNum) &&
    rentAmountNum > 0;

  const canSubmit = isValid && !buildingsLoading && !roomsLoading && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError("");

    const body: CreateDraftManualRequest = {
      customerId: customerIdNum,
      buildingId: Number(form.buildingId),
      roomId: Number(form.roomId),
      startDate: form.startDate,
      rentAmount: rentAmountNum,
    };

    try {
      await contractsApi.createManualDraft(body);
      navigate("/admin/contracts");
    } catch (err) {
      setSubmitError(errText(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Hợp đồng · Tạo mới"
        title="Tạo hợp đồng nháp"
        desc="Tạo hợp đồng nháp trực tiếp cho khách hàng và phòng đã chọn."
      />

      <div className="panel" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {/* Customer ID */}
            <Field
              label="Mã khách hàng (ID)"
              hint="Nhập ID số của khách hàng (customerId). Hệ thống không cung cấp danh sách khách hàng qua giao diện này."
            >
              <input
                inputMode="numeric"
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                placeholder="Ví dụ: 42"
                aria-required="true"
              />
            </Field>

            {/* Building select */}
            <Field label="Tòa nhà">
              {buildingsError ? (
                <div className="alert alert-error">
                  <Icon name="shield" size={16} />
                  <div>{buildingsError}</div>
                </div>
              ) : (
                <select
                  value={form.buildingId}
                  disabled={buildingsLoading}
                  aria-required="true"
                  onChange={(e) => setForm({ ...form, buildingId: e.target.value, roomId: "" })}
                >
                  <option value="">
                    {buildingsLoading ? "Đang tải tòa nhà…" : "Chọn tòa nhà"}
                  </option>
                  {buildings.map((b) => (
                    <option key={b.buildingId} value={b.buildingId}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {/* Room select */}
            <Field label="Phòng">
              {roomsError ? (
                <div className="alert alert-error">
                  <Icon name="shield" size={16} />
                  <div>{roomsError}</div>
                </div>
              ) : (
                <select
                  value={form.roomId}
                  disabled={!form.buildingId || roomsLoading}
                  aria-required="true"
                  onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                >
                  <option value="">
                    {!form.buildingId
                      ? "Chọn tòa nhà trước"
                      : roomsLoading
                        ? "Đang tải phòng…"
                        : rooms.length === 0
                          ? "Không có phòng trống"
                          : "Chọn phòng"}
                  </option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomCode} — {r.area} m²
                      {r.basePrice ? ` · ${r.basePrice.toLocaleString("vi-VN")} VNĐ` : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {/* Start date */}
            <Field label="Ngày bắt đầu">
              <input
                type="date"
                value={form.startDate}
                aria-required="true"
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>

            {/* Rent amount */}
            <Field label="Giá thuê (VNĐ)" hint="Nhập số nguyên dương, không dấu thập phân.">
              <input
                type="number"
                min="1"
                step="1"
                value={form.rentAmount}
                aria-required="true"
                onChange={(e) => setForm({ ...form, rentAmount: e.target.value })}
                placeholder="Ví dụ: 5000000"
              />
            </Field>
          </div>

          {submitError && (
            <div className="alert alert-error mt-4">
              <Icon name="shield" size={18} />
              <div>{submitError}</div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="secondary-button"
              disabled={submitting}
              onClick={() => navigate("/admin/contracts")}
            >
              Hủy
            </button>
            <button type="submit" className="primary-button" disabled={!canSubmit}>
              {submitting ? "Đang tạo…" : "Tạo hợp đồng nháp"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
