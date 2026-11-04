import { useEffect, useRef, useState } from "react";
import { Icon } from "@/shared/ui";

type Props = {
  onChange?: (file: File | null) => void;
  onExport?: (file: File | null) => void;
  className?: string;
  width?: number;
  height?: number;
  penColor?: string;
};

export default function SignaturePad({
  onChange,
  onExport,
  className = "",
  width,
  height,
  penColor = "#0f172a",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [uploadedName, setUploadedName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const notifyChange = (file: File | null) => {
    onChange?.(file);
    onExport?.(file);
  };

  // Initialize canvas with high-DPI scaling
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (width || 400);
    const h = rect.height > 0 ? rect.height : (height || 160);

    canvas.width = w * dpr;
    canvas.height = h * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = penColor;
  };

  useEffect(() => {
    initCanvas();
    const timer = setTimeout(initCanvas, 120);
    return () => clearTimeout(timer);
  }, [mode, width, height, penColor]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = penColor;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    if (!hasSignature) {
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `signature_${Date.now()}.png`, { type: "image/png" });
        notifyChange(file);
      }
    }, "image/png");
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing) {
        stopDrawing();
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDrawing]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    notifyChange(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected) {
      setUploadedName(selected.name);
      notifyChange(selected);
    } else {
      setUploadedName("");
      notifyChange(null);
    }
  };

  return (
    <div className={`rounded-xl border border-line bg-white p-4 shadow-sm ${className}`}>
      {/* Mode Switcher */}
      <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              mode === "draw"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-muted hover:bg-surface hover:text-text"
            }`}
            onClick={() => {
              setMode("draw");
              setUploadedName("");
              if (!hasSignature) notifyChange(null);
            }}
          >
            Vẽ chữ ký bằng chuột / cảm ứng
          </button>
          <button
            type="button"
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              mode === "upload"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-muted hover:bg-surface hover:text-text"
            }`}
            onClick={() => {
              setMode("upload");
              if (!uploadedName) notifyChange(null);
            }}
          >
            Tải ảnh chữ ký từ máy
          </button>
        </div>

        {mode === "draw" && hasSignature && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-danger hover:underline"
            onClick={clearCanvas}
          >
            <Icon name="close" size={14} />
            <span>Ký lại</span>
          </button>
        )}
      </div>

      {mode === "draw" ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="h-40 w-full touch-none cursor-crosshair rounded-lg border border-dashed border-teal-300 bg-teal-50/20"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!hasSignature && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-muted/60 select-none">
              <span className="text-sm font-medium">Ký tên tại đây (dùng chuột hoặc ngón tay)</span>
              <span className="mt-1 text-xs">Giữ và kéo để vẽ chữ ký của bạn</span>
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
            <span>
              {hasSignature ? (
                <span className="font-semibold text-emerald-700">Đã vẽ chữ ký thành công</span>
              ) : (
                "Chữ ký sẽ được nhúng vào hợp đồng điện tử PDF"
              )}
            </span>
          </div>
        </div>
      ) : (
        <div className="py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 p-5 text-center hover:bg-surface"
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="image" size={20} />
            <span className="mt-1.5 text-xs font-semibold text-text">
              {uploadedName ? `Đã chọn: ${uploadedName}` : "Bấm để chọn tệp ảnh chữ ký (PNG, JPG)"}
            </span>
            <span className="mt-0.5 text-[11px] text-muted">Tối đa 2 MB</span>
          </button>
        </div>
      )}
    </div>
  );
}
