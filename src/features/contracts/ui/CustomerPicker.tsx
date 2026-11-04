import { useEffect, useState } from "react";
import { Icon } from "@/shared/ui";
import { searchCustomers, type UserProfile } from "@/api/userNotification";
import { useCustomerLookup } from "@/shared/lib/refLabels";
import { idStr } from "@/shared/lib/id";
import { errorText } from "@/shared/api/errors";

const errText = (e: unknown) => errorText(e, "Không tải được danh sách khách hàng.");

type Props = {
  value: string;
  onChange: (customerId: string) => void;
  disabled?: boolean;
};

/** Chọn khách hàng từ danh sách có tìm kiếm thay vì gõ customerId thô. */
export function CustomerPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [options, setOptions] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pickedLabel, setPickedLabel] = useState("");
  const customerOf = useCustomerLookup([value]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      searchCustomers(keyword.trim())
        .then((page) => { if (active) setOptions(page.content ?? []); })
        .catch((cause) => { if (active) { setOptions([]); setError(errText(cause)); } })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, keyword]);

  const label = pickedLabel || customerOf(value) || "";

  return (
    <div className="field">
      <span className="field-label">Khách hàng</span>
      {!open ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
          <span className={`min-w-0 flex-1 truncate text-sm ${value ? "" : "text-muted"}`}>
            {value ? (label ? `${label} · #${value}` : `Khách #${value}`) : "Chưa chọn khách hàng"}
          </span>
          <button
            type="button"
            className="text-button shrink-0 !text-xs"
            disabled={disabled}
            onClick={() => { setKeyword(""); setOpen(true); }}
          >
            {value ? "Đổi khách" : "Chọn khách"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-white">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Icon name="search" size={15} />
            <input
              autoFocus
              className="min-w-0 flex-1"
              placeholder="Tên, số điện thoại hoặc mã khách…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <button type="button" className="text-button shrink-0 !text-xs" onClick={() => setOpen(false)}>
              Đóng
            </button>
          </div>
          <div className="max-h-56 overflow-auto">
            {loading ? (
              <p className="px-3 py-2 text-xs text-muted">Đang tìm khách hàng…</p>
            ) : error ? (
              <p className="px-3 py-2 text-xs text-coral">{error}</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted">Không tìm thấy khách hàng phù hợp.</p>
            ) : (
              options.map((customer) => {
                const customerId = idStr(customer.id);
                const selected = customerId === value;
                return (
                  <button
                    key={customerId}
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#f5f8f4] ${selected ? "bg-[#f5f8f4]" : ""}`}
                    onClick={() => {
                      onChange(customerId);
                      setPickedLabel(customer.fullName ?? "");
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <b>{customer.fullName?.trim() || "Khách chưa đặt tên"}</b>
                      <span className="text-xs text-muted">
                        {" "}· #{customerId}{customer.phone ? ` · ${customer.phone}` : ""}
                      </span>
                    </span>
                    {selected && <Icon name="check" size={15} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
      <span className="field-hint">Tìm theo tên, số điện thoại hoặc mã khách; danh sách lấy từ hồ sơ khách hàng.</span>
    </div>
  );
}
