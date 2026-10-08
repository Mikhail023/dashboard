import { useEffect, useRef, type ReactNode } from "react";
import { X, Plus, Inbox, ArrowUpRight } from "lucide-react";
import { labels } from "../../shared/model";
export function Button({
  children,
  secondary = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      className={`${secondary ? "button secondary" : "button"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function IconButton({
  children,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className="icon-button" title={label} aria-label={label} {...props}>
      {children}
    </button>
  );
}
export function Card({
  children,
  className = "",
  title,
  action,
  ...props
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section className={`card ${className}`} {...props}>
      {title && (
        <div className="card-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{labels[status] ?? status}</span>;
}
export function Empty({
  text = "Здесь пока ничего нет",
  onCreate,
}: {
  text?: string;
  onCreate?: () => void;
}) {
  return (
    <div className="empty">
      <Inbox size={34} strokeWidth={1.2} />
      <h3>{text}</h3>
      <p>Добавьте первую запись — и всё будет под рукой.</p>
      {onCreate && (
        <Button onClick={onCreate}>
          <Plus size={16} />
          Добавить
        </Button>
      )}
    </div>
  );
}
export function Heading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("input,button,select")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'input:not([disabled]),button:not([disabled]),select,textarea,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="card-heading">
          <h2>{title}</h2>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Stat({
  label,
  value,
  caption,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  caption: string;
  accent?: boolean;
}) {
  return (
    <div className={`card stat ${accent ? "accent-card" : ""}`}>
      <div className="card-heading">
        <span>{label}</span>
        <ArrowUpRight size={18} />
      </div>
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}
export function Tabs({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          className={id === value ? "active" : ""}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
