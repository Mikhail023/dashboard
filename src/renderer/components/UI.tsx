import AnimatedNumber from "../animation/AnimatedNumber";
import { motion, LayoutGroup, useIsPresent } from "motion/react";
import { useMotionReduced } from "../animation/MotionProvider";
import { fade, surface } from "../animation/variants";
import { transitions } from "../animation/transitions";
import { springs } from "../animation/tokens";
import { useEffect, useRef, useId, forwardRef, type ReactNode } from "react";
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
export const Card = forwardRef<
  HTMLElement,
  {
    children: ReactNode;
    className?: string;
    title?: string;
    action?: ReactNode;
  } & Omit<React.HTMLAttributes<HTMLElement>, "title">
>(function Card({ children, className = "", title, action, ...props }, ref) {
  return (
    <section ref={ref} className={`card ${className}`} {...props}>
      {title && (
        <div className="card-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
});
export const MotionCard = motion.create(Card);
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
    <motion.div
      className="empty"
      variants={fade}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={transitions.fast}
    >
      <Inbox size={34} strokeWidth={1.2} />
      <h3>{text}</h3>
      <p>Добавьте первую запись — и всё будет под рукой.</p>
      {onCreate && (
        <Button onClick={onCreate}>
          <Plus size={16} />
          Добавить
        </Button>
      )}
    </motion.div>
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
  const present = useIsPresent();
  const reduced = useMotionReduced();
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  if (present && !previousFocus.current && typeof document !== "undefined")
    previousFocus.current = document.activeElement as HTMLElement;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (ref.current) ref.current.inert = !present;
    if (!present) return;
    ref.current
      ?.querySelector<HTMLElement>("[data-autofocus],input:not([type=hidden]),button,select")
      ?.focus();
    const key = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll(
        '[role="dialog"]:not([aria-hidden="true"])',
      );
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
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
      previousFocus.current?.focus();
      previousFocus.current = null;
    };
  }, [present]);
  return (
    <motion.div
      className="modal-backdrop"
      variants={fade}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={transitions.fast}
      style={{ pointerEvents: present ? "auto" : "none" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={ref}
        variants={reduced ? fade : surface}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={transitions.fast}
        aria-hidden={!present || undefined}
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
      </motion.div>
    </motion.div>
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
      <strong>
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </strong>
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
  const id = useId();
  const reduced = useMotionReduced();
  return (
    <LayoutGroup id={id}>
      <div className="tabs" role="tablist">
        {options.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={value === id}
            tabIndex={value === id ? 0 : -1}
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                return;
              e.preventDefault();
              const current = options.findIndex(([key]) => key === id);
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : (current +
                        (e.key === "ArrowRight" ? 1 : -1) +
                        options.length) %
                      options.length;
              onChange(options[next][0]);
            const buttons = e.currentTarget.parentElement?.querySelectorAll("button");
            buttons?.item(next)?.focus();
            }}
            className={id === value ? "active" : ""}
            onClick={() => onChange(id)}
          >
            {value === id && (
              <motion.i
                className="tab-active-indicator"
                aria-hidden="true"
                layoutId={reduced ? undefined : "selection"}
                transition={springs.snappy}
              />
            )}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
