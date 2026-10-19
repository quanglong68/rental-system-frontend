import React from "react";
import { Icon } from "./Icon";

export type Tone = "teal" | "amber" | "coral" | "slate" | "sky" | "violet";

export function Pill({ tone = "slate", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function PageHead({ eyebrow, title, desc, actions }: { eyebrow: string; title: string; desc: string; actions?: React.ReactNode }) {
  return (
    <section className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{desc}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

export function Tabs({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="tabs">
      {items.map((t) => (
        <button key={t} className={value === t ? "tab-on" : ""} onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  );
}

export function MiniStat({ label, value, note, tone = "teal" }: { label: string; value: string; note: string; tone?: Tone }) {
  return (
    <article className="stat-card">
      <span className="stat-label">{label}</span>
      <div className="stat-value !mt-3 !text-[24px]">{value}</div>
      <div className="stat-foot"><span className={`dot dot-${tone}`}></span>{note}</div>
    </article>
  );
}

export function Toolbar({ placeholder, children }: { placeholder: string; children?: React.ReactNode }) {
  return (
    <div className="toolbar">
      <label className="field-search"><Icon name="search" size={16} /><input placeholder={placeholder} /></label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Ngăn kéo bên phải dùng cho chi tiết & biểu mẫu */
export function Drawer({ open, title, eyebrow, onClose, children, footer, wide }: { open: boolean; title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="drawer-root" role="dialog" aria-modal="true">
      <button className="drawer-scrim" onClick={onClose} aria-label="Đóng"></button>
      <aside className={`drawer ${wide ? "drawer-wide" : ""}`}>
        <header className="drawer-head">
          <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>
          <button className="icon-button !h-9 !w-9" onClick={onClose} aria-label="Đóng"><Icon name="close" size={17} /></button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Thông báo nổi đơn giản: const [toast, show] = useToast() */
export function useToast() {
  const [msg, setMsg] = React.useState<string | null>(null);
  const show = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 2600); };
  const node = msg ? <div className="toast"><Icon name="check" size={16} />{msg}</div> : null;
  return [node, show] as const;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? "switch-on" : ""}`} onClick={() => onChange(!on)}><span></span></button>;
}
