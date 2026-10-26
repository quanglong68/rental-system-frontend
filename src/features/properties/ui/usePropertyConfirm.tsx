import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./property.css";

type Confirmation = { title: string; message: string; confirmLabel: string };

/** Custom confirmation shared by property management actions. */
export function usePropertyConfirm() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  const finish = useCallback((confirmed: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    dialogRef.current?.close();
    setRequest(null);
    resolve?.(confirmed);
  }, []);

  useEffect(() => () => {
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  useEffect(() => {
    if (!request) return;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [request]);

  const confirm = useCallback((options: Confirmation): Promise<boolean> => {
    if (resolveRef.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setRequest(options);
    });
  }, []);

  const popup = request ? createPortal(
    <dialog ref={dialogRef} className="property-confirm" aria-labelledby={titleId} aria-describedby={messageId}
      onCancel={(event) => { event.preventDefault(); finish(false); }}>
      <h2 id={titleId}>{request.title}</h2>
      <p id={messageId}>{request.message}</p>
      <div className="property-confirm-actions">
        <button type="button" className="secondary-button" autoFocus onClick={() => finish(false)}>Hủy</button>
        <button type="button" className="danger-button" onClick={() => finish(true)}>{request.confirmLabel}</button>
      </div>
    </dialog>, document.body,
  ) : null;

  return [popup, confirm] as const;
}
