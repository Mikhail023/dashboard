import { lazy, Suspense, useEffect, useState, useMemo, useRef } from "react";
import {
  LayoutDashboard,
  StickyNote,
  SquareCheckBig,
  CalendarDays,
  ChartNoAxesCombined,
  FolderKanban,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  Sun,
  Moon,
  Bell,
  HardDrive,
  Check,
  PanelLeftClose,
  Inbox,
  History,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp, action, active, type Page } from "./store";
import { Button, IconButton, Modal } from "./components/UI";
import EntityForm from "./components/EntityForm";
import CommandSearch from "./components/Search";
import SmartInput from "./components/SmartInput";
import BrandLogo from "./components/BrandLogo";
import { commandKey, commandPressed } from "../shared/platform";
import Auth from "./pages/Auth";
import { localDay } from "../shared/smart-input";
import { tasksInRange } from "../shared/recurrence";
import { occurrences } from "../shared/calculations";
import { addDays, endOfDay } from "date-fns";
import { useNow } from "./hooks/useNow";
const pages = {
  habits: lazy(() => import("./pages/Habits")),
  focus: lazy(() => import("./pages/Focus")),
  timeline: lazy(() => import("./pages/Timeline")),
  inbox: lazy(() => import("./pages/Inbox")),
  dashboard: lazy(() => import("./pages/Dashboard")),
  notes: lazy(() => import("./pages/Notes")),
  tasks: lazy(() => import("./pages/Tasks")),
  calendar: lazy(() => import("./pages/Calendar")),
  finance: lazy(() => import("./pages/Finance")),
  projects: lazy(() => import("./pages/Projects")),
  settings: lazy(() => import("./pages/Settings")),
  help: lazy(() => import("./pages/Help")),
};
const navigation: [Page, string, LucideIcon][] = [
  ["habits", "Привычки", Target],
  ["inbox", "Входящие", Inbox],
  ["dashboard", "Дашборд", LayoutDashboard],
  ["notes", "Заметки", StickyNote],
  ["tasks", "Задачи", SquareCheckBig],
  ["calendar", "Календарь", CalendarDays],
  ["finance", "Финансы", ChartNoAxesCombined],
  ["projects", "Проекты", FolderKanban],
  ["timeline", "История дня", History],
  ["focus", "Фокус", Target],
];
export default function App() {
  const { state, auth, page, toast, editor, searchOpen, navigate } = useApp();
  const [notifications, setNotifications] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const hasReportedReady = useRef(false);
  useEffect(() => {
    void useApp.getState().init();
    const off = window.dashboard.onLock(() => {
      useApp.setState({
        state: null,
        editor: null,
        searchOpen: false,
        smartOpen: false,
      });
      void useApp.getState().init();
    });
    const offTimer = window.dashboard.onTimer(() => {
      if (useApp.getState().state) void useApp.getState().refresh();
    });
    return () => {
      off();
      offTimer();
    };
  }, []);
  useEffect(() => {
    if (auth && !hasReportedReady.current) {
      hasReportedReady.current = true;
      window.dashboard.rendererReady();
    }
  }, [auth]);
  const theme = state?.settings.theme ?? auth?.theme ?? "system";
  const accent = state?.settings.accentColor;
  useEffect(() => {
    const root = document.documentElement;
    if (!accent) {
      delete root.dataset.accent;
      root.style.removeProperty("--accent-base");
      root.style.removeProperty("--accent-ink");
      return;
    }
    root.dataset.accent = "custom";
    root.style.setProperty("--accent-base", accent);
    const rgb = [1, 3, 5]
      .map((i) => parseInt(accent.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    root.style.setProperty(
      "--accent-ink",
      luminance > 0.179 ? "#101418" : "#ffffff",
    );
  }, [accent]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (commandPressed(e) && e.shiftKey && e.code === "Space" && state) {
        e.preventDefault();
        useApp.setState({ smartOpen: true, searchOpen: false });
      }
      if (commandPressed(e) && e.key.toLowerCase() === "k" && state) {
        e.preventDefault();
        useApp.setState({ searchOpen: !useApp.getState().searchOpen });
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [state]);
  const now = useNow(),
    today = localDay(now);
  const data = state?.data;
  const overdue = useMemo(
    () =>
      data
        ? [
            ...new Map(
              tasksInRange(
                data,
                undefined,
                endOfDay(new Date(today + "T12:00")),
              )
                .filter(
                  (t) =>
                    t.due_date &&
                    t.due_date.slice(0, 10) < today &&
                    t.status !== "done",
                )
                .map((t) => [t.id, t]),
            ).values(),
          ]
        : [],
    [data, today],
  );
  const notices = state
    ? [
        ...overdue.map((t) => ({
          label: t.title,
          detail: "Просроченная задача",
          page: "tasks" as Page,
          id: t.id,
        })),
        ...active(state.data.events)
          .filter((e) => occurrences(e, now, addDays(now, 7)).length > 0)
          .map((e) => ({
            label: e.title,
            detail: "Ближайшее событие",
            page: "calendar" as Page,
            id: e.id,
          })),
        ...active(state.data.invoices)
          .filter((i) => i.status !== "paid" && i.status !== "draft")
          .map((i) => ({
            label: i.number,
            detail: "Неоплаченный счёт",
            page: "finance" as Page,
            id: i.id,
          })),
      ]
    : [];
  const PageComponent = pages[page];
  return (
    <>
      {!auth ? (
        <div className="loading">Открываем ваше пространство…</div>
      ) : !state ? (
        <Auth />
      ) : (
        <div
          className={`app ${collapsed ? "sidebar-collapsed" : ""} ${state.settings.density === "compact" ? "compact" : ""}`}
        >
          <aside className="sidebar">
            <button className="brand" onClick={() => navigate("dashboard")}>
              <span className="logo logo-image">
                <BrandLogo />
              </span>
              <strong>Dashboard</strong>
            </button>
            <div className="section-label">МЕНЮ</div>
            <nav>
              {navigation.map(([id, label, Icon]) => (
                <button
                  title={label}
                  key={id}
                  className={page === id ? "active" : ""}
                  onClick={() => navigate(id)}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                  {id === "inbox" && (
                    <small>
                      {
                        active(state.data.inbox).filter(
                          (i) => i.status === "pending",
                        ).length
                      }
                    </small>
                  )}
                  {id === "tasks" && (
                    <small>
                      {
                        active(state.data.tasks).filter(
                          (t) => t.status !== "done",
                        ).length
                      }
                    </small>
                  )}
                </button>
              ))}
            </nav>
            <div className="section-label general">ОБЩЕЕ</div>
            <nav>
              {[
                ["settings", "Настройки", Settings],
                ["help", "Помощь", HelpCircle],
              ].map(([id, label, Icon]) => {
                const I = Icon as LucideIcon;
                return (
                  <button
                    title={String(label)}
                    key={String(id)}
                    className={page === id ? "active" : ""}
                    onClick={() => navigate(id as Page)}
                  >
                    <I size={20} />
                    <span>{String(label)}</span>
                  </button>
                );
              })}
              <button
                title="Заблокировать"
                onClick={() => void action({ action: "lock" })}
              >
                <LogOut size={20} />
                <span>Заблокировать</span>
              </button>
            </nav>
            <div className="sidebar-bottom">
              <div className="backup-card">
                <HardDrive size={24} />
                <strong>Резервная копия</strong>
                <p>
                  {state.settings.lastBackup
                    ? `Последняя: ${new Date(state.settings.lastBackup).toLocaleDateString("ru-RU")}`
                    : "Позаботьтесь о своих данных"}
                </p>
                <Button
                  onClick={() =>
                    void action({ action: "backup" }, "Резервная копия создана")
                  }
                >
                  Создать копию
                </Button>
              </div>
              <button
                className="collapse-button"
                onClick={() => setCollapsed(!collapsed)}
                aria-label="Свернуть боковую панель"
              >
                <PanelLeftClose size={17} />
                <span>Свернуть</span>
              </button>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <button
                className="global-search"
                onClick={() => useApp.setState({ searchOpen: true })}
              >
                <Search size={18} />
                <span>Поиск по всему приложению…</span>
                <kbd>{commandKey()} K</kbd>
              </button>
              <div className="topbar-right">
                <Button
                  secondary
                  onClick={() => useApp.setState({ smartOpen: true })}
                >
                  Быстрый ввод
                </Button>
                <IconButton
                  label="Переключить тему"
                  onClick={() =>
                    void action({
                      action: "settings",
                      data: {
                        theme: document.documentElement.classList.contains(
                          "dark",
                        )
                          ? "light"
                          : "dark",
                      },
                    })
                  }
                >
                  {document.documentElement.classList.contains("dark") ? (
                    <Sun size={20} />
                  ) : (
                    <Moon size={20} />
                  )}
                </IconButton>
                <IconButton
                  label="Уведомления"
                  onClick={() => setNotifications(true)}
                >
                  <Bell size={20} />
                  {notices.length > 0 && <i className="notification-dot" />}
                </IconButton>
                <button
                  className="profile-button"
                  onClick={() => navigate("settings")}
                >
                  <span className="avatar">{state.profile.avatar_path}</span>
                  <span>
                    <strong>{state.profile.name}</strong>
                    <small>
                      {state.profile.email || "Личное пространство"}
                    </small>
                  </span>
                </button>
              </div>
            </header>
            <main>
              <Suspense fallback={<div className="loading">Загрузка…</div>}>
                <PageComponent key={page + useApp.getState().selected} />
              </Suspense>
            </main>
            <footer className="statusbar">
              <span>
                <i className="dot" />
                Локальное хранение
              </span>
              <span>Dashboard · Только на вашем устройстве</span>
            </footer>
          </div>
          {editor && (
            <EntityForm key={editor.table + (editor.row?.id ?? "new")} />
          )}{" "}
          {searchOpen && <CommandSearch />}
          {state && useApp.getState().smartOpen && <SmartInput />}
          {notifications && (
            <Modal title="Уведомления" onClose={() => setNotifications(false)}>
              {notices.length ? (
                notices.map((n) => (
                  <button
                    key={n.id}
                    className="simple-row"
                    onClick={() => {
                      setNotifications(false);
                      if (n.page === "calendar")
                        useApp.getState().edit(
                          "events",
                          state.data.events.find((e) => e.id === n.id),
                        );
                      else navigate(n.page, n.id);
                    }}
                  >
                    <span>
                      <strong>{n.label}</strong>
                      <small className="block muted">{n.detail}</small>
                    </span>
                  </button>
                ))
              ) : (
                <div className="empty">
                  <Check size={28} />
                  <p>Всё под контролем</p>
                </div>
              )}
            </Modal>
          )}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
