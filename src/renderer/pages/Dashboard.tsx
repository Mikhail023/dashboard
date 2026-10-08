import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Plus,
  Upload,
  ArrowUpRight,
  CalendarDays,
  Play,
  ArrowRight,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { startOfWeek, addDays, format, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { useApp, useData, active, action } from "../store";
import {
  progress,
  summary,
  formatMoney,
  occurrences,
} from "../../shared/calculations";
import {
  Button,
  Card,
  Empty,
  Heading,
  IconButton,
  Modal,
  Stat,
} from "../components/UI";
import HabitWidget from "../components/HabitWidget";
import Timer from "../components/Timer";
import DailyBrief from "../components/DailyBrief";
import { useNow } from "../hooks/useNow";
import { tasksInRange, nextRecurrence } from "../../shared/recurrence";
import { dailyOverview } from "../../shared/daily";
import FinancePlanning from "../components/FinancePlanning";
import { remainingBudget } from "../../shared/finance-planning";
import {
  widgetDefaults as defaults,
  loadWidgets,
} from "../../shared/dashboard";
import { localDay } from "../../shared/smart-input";
const kpiDefaults = [
  { id: "all", title: "Всего проектов", visible: true },
  { id: "ended", title: "Завершённые", visible: true },
  { id: "running", title: "В работе", visible: true },
  { id: "pending", title: "Ожидают", visible: true },
];
export default function Dashboard() {
  const data = useData(),
    state = useApp((s) => s.state)!,
    selected = useApp((s) => s.selected),
    edit = useApp((s) => s.edit),
    navigate = useApp((s) => s.navigate);
  const [customize, setCustomize] = useState(
      useApp.getState().selected === "customize",
    ),
    [week, setWeek] = useState(0),
    [gridEditing, setGridEditing] = useState(false);
  useEffect(() => {
    if (selected === "customize") setCustomize(true);
  }, [selected]);
  const [widgets, saveWidgets] = useState<typeof defaults>(() => {
    try {
      return loadWidgets(state.settings.dashboard);
    } catch {
      return defaults;
    }
  });
  const [kpis, saveKpis] = useState<typeof kpiDefaults>(() => {
    try {
      return state.settings.kpis
        ? (JSON.parse(state.settings.kpis) as typeof kpiDefaults)
        : kpiDefaults;
    } catch {
      return kpiDefaults;
    }
  });
  const closeCustomize = useCallback(async () => {
    setCustomize(false);
    await action(
      {
        action: "settings",
        data: {
          dashboard: JSON.stringify(widgets),
          kpis: JSON.stringify(kpis),
        },
      },
      "Дашборд настроен",
    );
    navigate("dashboard");
  }, [widgets, kpis, navigate]);
  const commitWidgets = (next: typeof defaults) => {
    saveWidgets(next);
    void action({
      action: "settings",
      data: { dashboard: JSON.stringify(next) },
    });
  };
  const moveWidget = (source: string, target: string) => {
    const next = [...widgets],
      from = next.findIndex((w) => w.id === source),
      to = next.findIndex((w) => w.id === target);
    if (from < 0 || to < 0 || from === to) return;
    next.splice(to, 0, next.splice(from, 1)[0]);
    commitWidgets(next);
  };
  const now = useNow();
  const day = localDay(now),
    currency = state.settings.currency ?? "RUB";
  const tasks = useMemo(
    () => tasksInRange(data, undefined, endOfDay(new Date(day + "T12:00"))),
    [data, day],
  );
  const daily = useMemo(
    () => dailyOverview(data, day, currency),
    [data, day, currency],
  );
  const projects = active(data.projects),
    notes = active(data.notes)
      .filter((n) => !n.archived)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const events = active(data.events)
    .flatMap((event) => {
      const dates = occurrences(event, now, addDays(now, 30));
      const next = dates.length
        ? undefined
        : nextRecurrence(event.start_at, event, now);
      return (next ? [next] : dates).map((date) => ({ event, date }));
    })
    .sort((a, b) => +a.date - +b.date);
  const event = events[0];
  const stats = summary(data, state.settings.currency ?? "RUB");
  const start = addDays(
    startOfWeek(now, {
      weekStartsOn: Number(state.settings.weekStart ?? 1) as 0 | 1,
    }),
    week * 7,
  );
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const completionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const taskIds = new Set(
      data.tasks.filter((t) => !t.deleted_at).map((t) => t.id),
    );
    const dates = [
      ...data.tasks
        .filter(
          (t) => !t.deleted_at && !t.recurrence_rule && t.status === "done",
        )
        .map((t) => t.completed_at),
      ...data.task_completions
        .filter((c) => !c.deleted_at && taskIds.has(c.task_id))
        .map((c) => c.completed_at),
    ];
    for (const timestamp of dates.filter(Boolean)) {
      const date = localDay(new Date(timestamp));
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
    return counts;
  }, [data]);
  const counts = days.map((d) => completionCounts.get(localDay(d)) ?? 0),
    max = Math.max(1, ...counts);
  const done = progress(tasks);
  const working = tasks.length
    ? (tasks.filter((t) => t.status === "in_progress").length / tasks.length) *
      100
    : 0;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1),
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const newCount = projects.filter(
      (p) => new Date(p.created_at) >= monthStart,
    ).length,
    previousCount = projects.filter(
      (p) =>
        new Date(p.created_at) >= previousStart &&
        new Date(p.created_at) < monthStart,
    ).length;
  const expenseCategories = useMemo(() => {
    const accounts = new Set(
      data.accounts
        .filter((a) => !a.deleted_at && a.currency === currency)
        .map((a) => a.id),
    );
    const sums = new Map<string, number>();
    for (const t of data.transactions)
      if (
        !t.deleted_at &&
        t.type === "expense" &&
        accounts.has(t.account_id) &&
        t.date.startsWith(day.slice(0, 7))
      )
        sums.set(
          t.category_id,
          (sums.get(t.category_id) ?? 0) + Math.round(t.amount * 100),
        );
    const names = new Map(data.categories.map((c) => [c.id, c.name]));
    return [...sums]
      .map(([id, cents]) => ({
        id,
        name: names.get(id) ?? "Без категории",
        amount: cents / 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [data, currency, day]);
  function categoryBars(size: string) {
    return expenseCategories.slice(0, size === "L" ? 10 : 3).map((c) => (
      <div className="category-bar" key={c.id}>
        <div className="progress-label">
          <span>{c.name}</span>
          <strong>{formatMoney(c.amount, currency)}</strong>
        </div>
        {size === "L" && (
          <div className="progress">
            <i
              style={{
                width: `${stats.expense ? (c.amount / stats.expense) * 100 : 0}%`,
              }}
            />
          </div>
        )}
      </div>
    ));
  }
  function content(id: string, size = "M") {
    if (id === "habits") return <HabitWidget size={size} />;
    if (size === "S" && id !== "timer") {
      const compact: Record<string, string | number> = {
        analytics: counts.reduce((a, b) => a + b, 0),
        reminders: event
          ? `${event.event.title} · ${format(event.date, "HH:mm")}`
          : "Нет событий",
        projects: projects.filter((p) => p.status !== "ended").length,
        progress: `${done}%`,
        finance: formatMoney(stats.balance, state.settings.currency ?? "RUB"),
        notes: active(data.notes).filter((n) => !n.archived).length,
        today: tasks.filter(
          (t) =>
            t.status !== "done" && t.due_date.slice(0, 10) === localDay(now),
        ).length,
        overdue: tasks.filter(
          (t) =>
            t.status !== "done" &&
            t.due_date &&
            t.due_date.slice(0, 10) < localDay(now),
        ).length,
        expenses: formatMoney(stats.expense, state.settings.currency ?? "RUB"),
        inbox: active(data.inbox).filter((i) => i.status === "pending").length,
        daily: daily.completed,
        budgets:
          remainingBudget(data, state.settings.currency ?? "RUB") === null
            ? "Не задан"
            : formatMoney(
                remainingBudget(data, state.settings.currency ?? "RUB")!,
                state.settings.currency ?? "RUB",
              ),
        goals: active(data.financial_goals).filter(
          (g) => g.status !== "completed",
        ).length,
      };
      return <strong className="compact-value">{compact[id]}</strong>;
    }
    switch (id) {
      case "budgets":
        return (
          <FinancePlanning
            kind="budgets"
            compact
            limit={size === "L" ? 10 : 3}
          />
        );
      case "goals":
        return (
          <FinancePlanning
            kind="financial_goals"
            compact
            limit={size === "L" ? 10 : 3}
          />
        );
      case "today":
      case "overdue": {
        const list = tasks.filter(
          (t) =>
            t.status !== "done" &&
            t.due_date &&
            (id === "today"
              ? t.due_date.slice(0, 10) === localDay(now)
              : t.due_date.slice(0, 10) < localDay(now)),
        );
        return (
          <>
            <strong className="big-number">{list.length}</strong>
            {list.slice(0, size === "L" ? 12 : 5).map((t) => (
              <button
                key={t.id + t.due_date}
                className="simple-row"
                onClick={() => navigate("tasks", t.id)}
              >
                {t.title}
                <small>{t.due_date.slice(0, 10)}</small>
              </button>
            ))}
            {!list.length && <p className="muted">Всё под контролем</p>}
          </>
        );
      }
      case "expenses":
        return (
          <>
            <strong className="big-number">
              {formatMoney(stats.expense, state.settings.currency ?? "RUB")}
            </strong>
            <p className="muted">Текущий месяц</p>
            {categoryBars(size)}
            {size === "L" && (
              <FinancePlanning kind="budgets" compact limit={10} />
            )}
            <Button secondary onClick={() => navigate("finance")}>
              Открыть финансы
            </Button>
          </>
        );
      case "inbox":
        return (
          <>
            <strong className="big-number">
              {active(data.inbox).filter((i) => i.status === "pending").length}
            </strong>
            <p className="muted">Необработанных записей</p>
            {size === "L" &&
              active(data.inbox)
                .filter((i) => i.status === "pending")
                .slice(0, 10)
                .map((i) => (
                  <button
                    className="simple-row"
                    key={i.id}
                    onClick={() => navigate("inbox", i.id)}
                  >
                    {i.title}
                  </button>
                ))}
            <Button secondary onClick={() => navigate("inbox")}>
              Разобрать
            </Button>
          </>
        );
      case "daily":
        return (
          <div className="form-stack">
            <p>Выполнено задач: {daily.completed}</p>
            <p>
              Новых заметок:{" "}
              {
                active(data.notes).filter(
                  (n) => localDay(new Date(n.created_at)) === localDay(now),
                ).length
              }
            </p>
            <p>
              Операций:{" "}
              {
                active(data.transactions).filter(
                  (t) => t.date.slice(0, 10) === localDay(now),
                ).length
              }
            </p>
            {size === "L" && (
              <>
                <p>
                  Событий: {daily.events} · Расходы:{" "}
                  {formatMoney(daily.expenses, currency)}
                </p>
                {daily.items.slice(-8).map((i) => (
                  <button
                    key={i.key}
                    className="simple-row"
                    onClick={() => navigate("timeline")}
                  >
                    {i.title}
                    <small>{i.label}</small>
                  </button>
                ))}
              </>
            )}
          </div>
        );
      case "analytics":
        return (
          <>
            <div className="chart-top">
              <small>Выполненные задачи</small>
              <select
                aria-label="Период аналитики"
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
              >
                <option value={0}>Эта неделя</option>
                <option value={-1}>Прошлая неделя</option>
              </select>
            </div>
            <div className="weekly-chart">
              {days.map((d, i) => (
                <div key={i}>
                  <span className="chart-count">{counts[i]}</span>
                  <div
                    className={`chart-bar ${!counts[i] ? "hatched" : ""}`}
                    style={{
                      height: `${Math.max(12, (counts[i] / max) * 110)}px`,
                      opacity:
                        format(d, "yyyy-MM-dd") === format(now, "yyyy-MM-dd")
                          ? 1
                          : 0.75,
                    }}
                  />
                  <small>{format(d, "EEEEEE", { locale: ru })}</small>
                </div>
              ))}
            </div>
            {size === "L" && (
              <p>
                За неделю: {counts.reduce((a, b) => a + b, 0)} задач · В среднем
                за день: {(counts.reduce((a, b) => a + b, 0) / 7).toFixed(1)}
              </p>
            )}
            <div className="legend">
              <span>
                <i />
                Завершено
              </span>
              <span>
                <i className="hatched" />
                Нет завершённых задач
              </span>
            </div>
          </>
        );
      case "reminders":
        return event ? (
          <>
            <div className="reminder-main">
              <CalendarDays size={26} />
              <h3>{event.event.title}</h3>
              <p>{format(event.date, "d MMMM, HH:mm", { locale: ru })}</p>
              <Button
                className="full-width"
                onClick={() =>
                  event.event.project_id
                    ? void action(
                        {
                          action: "timer",
                          command: "start",
                          project_id: event.event.project_id,
                        },
                        "Таймер проекта запущен",
                      )
                    : edit("events", event.event)
                }
              >
                <Play size={15} />
                {event.event.project_id ? "Начать" : "Открыть"}
              </Button>
            </div>
            {events
              .slice(1, size === "L" ? 10 : 3)
              .map(({ event: e, date: d }) => (
                <button
                  className="reminder-row"
                  key={e.id + String(d)}
                  onClick={() => edit("events", e)}
                >
                  <i className="dot" style={{ background: e.color }} />
                  <span>{e.title}</span>
                  <small>{format(d, "d MMM", { locale: ru })}</small>
                </button>
              ))}
          </>
        ) : (
          <Empty text="Свободное время" onCreate={() => edit("events")} />
        );
      case "projects":
        return projects.some((p) => p.status !== "ended") ? (
          <div>
            {projects
              .filter((p) => p.status !== "ended")
              .slice(0, size === "L" ? 12 : 5)
              .map((p) => (
                <button
                  className="dashboard-project"
                  key={p.id}
                  onClick={() => navigate("projects", p.id)}
                >
                  <span className="project-icon" style={{ color: p.color }}>
                    {p.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.due_date
                        ? `Дедлайн: ${format(new Date(p.due_date), "d MMM", { locale: ru })}`
                        : "Без дедлайна"}
                    </small>
                  </span>
                  <div className="progress">
                    <i
                      style={{
                        width: `${progress(tasks.filter((t) => t.project_id === p.id))}%`,
                        background: p.color,
                      }}
                    />
                  </div>
                  <ArrowUpRight size={14} />
                </button>
              ))}
          </div>
        ) : (
          <Empty onCreate={() => edit("projects")} />
        );
      case "progress":
        return (
          <>
            {size === "L" && (
              <p>
                Всего: {tasks.length} · Выполнено:{" "}
                {tasks.filter((t) => t.status === "done").length} · В работе:{" "}
                {tasks.filter((t) => t.status === "in_progress").length}
              </p>
            )}
            <div className="gauge">
              <svg
                viewBox="0 0 240 140"
                role="img"
                aria-label={`Выполнено ${done}% задач`}
              >
                <defs>
                  <pattern
                    id="hatch"
                    width="6"
                    height="6"
                    patternTransform="rotate(35)"
                    patternUnits="userSpaceOnUse"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="6"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </pattern>
                </defs>
                <path
                  d="M 24 120 A 96 96 0 0 1 216 120"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="22"
                  strokeLinecap="round"
                />
                <path
                  d="M 24 120 A 96 96 0 0 1 216 120"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="22"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={`${done} 100`}
                />
                <path
                  d="M 24 120 A 96 96 0 0 1 216 120"
                  fill="none"
                  stroke="var(--primary-strong)"
                  strokeWidth="22"
                  pathLength="100"
                  strokeDasharray={`${working} 100`}
                  strokeDashoffset={-done}
                />
                <path
                  d="M 24 120 A 96 96 0 0 1 216 120"
                  fill="none"
                  stroke="url(#hatch)"
                  strokeWidth="22"
                  pathLength="100"
                  strokeDasharray={`${tasks.length ? (tasks.filter((t) => t.status === "pending").length / tasks.length) * 100 : 0} 100`}
                  strokeDashoffset={-done - working}
                />
                <text
                  x="120"
                  y="103"
                  textAnchor="middle"
                  fill="var(--text)"
                  fontSize="37"
                  fontWeight="600"
                >
                  {done}%
                </text>
                <text
                  x="120"
                  y="127"
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="12"
                >
                  Выполнено
                </text>
              </svg>
            </div>
            <div className="legend">
              <span>
                <i />
                Готово
              </span>
              <span>
                <i className="dark-dot" />В работе
              </span>
              <span>
                <i className="hatched" />
                Ожидает
              </span>
            </div>
          </>
        );
      case "timer":
        return <Timer size={size} />;
      case "finance":
        return (
          <>
            <button
              className="finance-balance"
              onClick={() => navigate("finance")}
            >
              <span>Общий баланс</span>
              <strong>
                {formatMoney(stats.balance, state.settings.currency ?? "RUB")}
              </strong>
            </button>
            <div className="mini-finance">
              <div>
                <small>Доходы за месяц</small>
                <strong className="positive">
                  {formatMoney(stats.income, state.settings.currency ?? "RUB")}
                </strong>
              </div>
              <div>
                <small>Расходы за месяц</small>
                <strong>
                  {formatMoney(stats.expense, state.settings.currency ?? "RUB")}
                </strong>
              </div>
            </div>
            <small className="muted">
              Неоплаченные счета:{" "}
              {formatMoney(stats.unpaid, state.settings.currency ?? "RUB")}
            </small>
            <div>{categoryBars(size)}</div>
            {size === "L" && (
              <FinancePlanning
                kind="budgets"
                compact
                limit={size === "L" ? 10 : 3}
              />
            )}
          </>
        );
      case "notes":
        return notes.length ? (
          <div className="recent-notes">
            {notes.slice(0, size === "L" ? 10 : 4).map((n) => (
              <button key={n.id} onClick={() => navigate("notes", n.id)}>
                <span className="note-color" style={{ background: n.color }} />
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.content_text || "Пустая заметка"}</p>
                  <small>
                    {format(new Date(n.updated_at), "d MMM, HH:mm", {
                      locale: ru,
                    })}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty onCreate={() => edit("notes")} />
        );
    }
  }
  return (
    <>
      <Heading
        title={state.settings.dashboardTitle || "Дашборд"}
        subtitle={
          state.settings.dashboardSubtitle ?? "Всё важное — в одном месте."
        }
      >
        <Button secondary onClick={() => setGridEditing(!gridEditing)}>
          {gridEditing ? "Готово" : "Переместить виджеты"}
        </Button>
        <IconButton
          label="Настроить дашборд"
          onClick={() => setCustomize(true)}
        >
          <SlidersHorizontal size={20} />
        </IconButton>
        <Button
          secondary
          onClick={() =>
            void action({ action: "importJSON" }, "Данные импортированы")
          }
        >
          <Upload size={16} />
          Импорт данных
        </Button>
        <Button onClick={() => edit("projects")}>
          <Plus size={18} />
          Добавить проект
        </Button>
      </Heading>
      <DailyBrief />
      {!projects.length && !tasks.length && (
        <div className="demo-banner">
          <div>
            <strong>
              Начните с чистого листа или познакомьтесь с Dashboard
            </strong>
            <p>Демо-данные помогут исследовать все возможности приложения.</p>
          </div>
          <Button
            secondary
            onClick={() =>
              void action({ action: "demo" }, "Демо-данные добавлены")
            }
          >
            Заполнить демо-данными
          </Button>
        </div>
      )}
      <div
        className="stats-grid"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, kpis.filter((k) => k.visible).length)},minmax(0,1fr))`,
        }}
      >
        {kpis
          .filter((k) => k.visible)
          .map((k) => (
            <button
              className="stat-link"
              key={k.id}
              onClick={() => navigate("projects")}
            >
              <Stat
                label={k.title}
                accent={k.id === "all"}
                value={
                  k.id === "all"
                    ? projects.length
                    : projects.filter((p) =>
                        k.id === "pending"
                          ? p.status === "pending" || p.status === "planned"
                          : p.status === k.id,
                      ).length
                }
                caption={
                  k.id === "all"
                    ? `${newCount - previousCount >= 0 ? "+" : ""}${newCount - previousCount} новых к прошлому месяцу`
                    : "Открыть проекты"
                }
              />
            </button>
          ))}
      </div>
      {gridEditing && (
        <p className="muted">
          Перетащите карточки или используйте стрелки. Изменения сохраняются
          автоматически.
        </p>
      )}
      <div
        className={`dashboard-grid adaptive-grid ${gridEditing ? "editing-grid" : ""}`}
      >
        {widgets
          .filter((w) => w.visible)
          .map((w) => (
            <Card
              key={w.id}
              title={w.title}
              className={`widget-${w.id} size-${w.size ?? "M"} ${w.id === "timer" ? "timer-card" : ""}`}
              draggable={gridEditing}
              onDragStart={(e) =>
                e.dataTransfer.setData("application/dashboard-widget", w.id)
              }
              onDragOver={(e) => {
                if (gridEditing) e.preventDefault();
              }}
              onDrop={(e) => {
                if (gridEditing) {
                  e.preventDefault();
                  moveWidget(
                    e.dataTransfer.getData("application/dashboard-widget"),
                    w.id,
                  );
                }
              }}
              action={
                w.id === "projects" || w.id === "notes" ? (
                  <IconButton
                    label={w.id === "projects" ? "Все проекты" : "Все заметки"}
                    onClick={() =>
                      navigate(w.id === "projects" ? "projects" : "notes")
                    }
                  >
                    <ArrowRight size={17} />
                  </IconButton>
                ) : (
                  <IconButton
                    label={`Настроить: ${w.title}`}
                    onClick={() => setCustomize(true)}
                  >
                    <SlidersHorizontal size={14} />
                  </IconButton>
                )
              }
            >
              {gridEditing && (
                <div className="widget-controls">
                  <select
                    aria-label={`Размер ${w.title}`}
                    value={w.size ?? "M"}
                    onChange={(e) =>
                      commitWidgets(
                        widgets.map((x) =>
                          x.id === w.id
                            ? { ...x, size: e.target.value as "S" | "M" | "L" }
                            : x,
                        ),
                      )
                    }
                  >
                    {["S", "M", "L"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <Button
                    secondary
                    onClick={() =>
                      commitWidgets(
                        widgets.map((x) =>
                          x.id === w.id ? { ...x, visible: false } : x,
                        ),
                      )
                    }
                  >
                    Скрыть
                  </Button>
                  <IconButton
                    label={`Переместить выше ${w.title}`}
                    disabled={widgets.indexOf(w) === 0}
                    onClick={() =>
                      moveWidget(w.id, widgets[widgets.indexOf(w) - 1].id)
                    }
                  >
                    <ArrowUp size={16} />
                  </IconButton>
                </div>
              )}
              {content(w.id, w.size)}
            </Card>
          ))}
      </div>
      {customize && (
        <Modal title="Ваш дашборд" onClose={closeCustomize}>
          <div className="form-stack">
            <label>
              Заголовок страницы
              <input
                defaultValue={state.settings.dashboardTitle || "Дашборд"}
                onBlur={(e) =>
                  void action({
                    action: "settings",
                    data: { dashboardTitle: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Подзаголовок
              <input
                defaultValue={
                  state.settings.dashboardSubtitle ??
                  "Всё важное — в одном месте."
                }
                onBlur={(e) =>
                  void action({
                    action: "settings",
                    data: { dashboardSubtitle: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <h3 style={{ marginTop: 24 }}>Показатели</h3>
          <div className="widget-settings">
            {kpis.map((k, i) => (
              <div className="row" key={k.id}>
                <input
                  type="checkbox"
                  aria-label={`Показать показатель ${k.title}`}
                  checked={k.visible}
                  onChange={(e) =>
                    saveKpis(
                      kpis.map((v) =>
                        v.id === k.id ? { ...v, visible: e.target.checked } : v,
                      ),
                    )
                  }
                />
                <input
                  aria-label="Название показателя"
                  value={k.title}
                  onChange={(e) =>
                    saveKpis(
                      kpis.map((v) =>
                        v.id === k.id ? { ...v, title: e.target.value } : v,
                      ),
                    )
                  }
                />
                <IconButton
                  label="Показатель выше"
                  disabled={i === 0}
                  onClick={() => {
                    const n = [...kpis];
                    [n[i - 1], n[i]] = [n[i], n[i - 1]];
                    saveKpis(n);
                  }}
                >
                  <ArrowUp size={16} />
                </IconButton>
              </div>
            ))}
          </div>
          <h3>Виджеты</h3>
          <p className="muted">
            Настройте названия, видимость и порядок виджетов. Изменения
            сохраняются при закрытии этого окна.
          </p>
          <div className="widget-settings">
            {widgets.map((w, i) => (
              <div
                className="row"
                key={w.id}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("application/dashboard-widget", w.id)
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  moveWidget(
                    e.dataTransfer.getData("application/dashboard-widget"),
                    w.id,
                  );
                }}
              >
                <select
                  aria-label={`Размер ${w.title}`}
                  value={w.size ?? "M"}
                  onChange={(e) =>
                    saveWidgets(
                      widgets.map((x) =>
                        x.id === w.id
                          ? { ...x, size: e.target.value as "S" | "M" | "L" }
                          : x,
                      ),
                    )
                  }
                >
                  {["S", "M", "L"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <input
                  type="checkbox"
                  aria-label={`Показать ${w.title}`}
                  checked={w.visible}
                  onChange={(e) =>
                    saveWidgets(
                      widgets.map((v) =>
                        v.id === w.id ? { ...v, visible: e.target.checked } : v,
                      ),
                    )
                  }
                />
                <input
                  aria-label="Название виджета"
                  value={w.title}
                  onChange={(e) =>
                    saveWidgets(
                      widgets.map((v) =>
                        v.id === w.id ? { ...v, title: e.target.value } : v,
                      ),
                    )
                  }
                />
                <IconButton
                  label="Выше"
                  disabled={i === 0}
                  onClick={() => {
                    const n = [...widgets];
                    [n[i - 1], n[i]] = [n[i], n[i - 1]];
                    saveWidgets(n);
                  }}
                >
                  <ArrowUp size={17} />
                </IconButton>
                <IconButton
                  label="Ниже"
                  disabled={i === widgets.length - 1}
                  onClick={() => {
                    const n = [...widgets];
                    [n[i + 1], n[i]] = [n[i], n[i + 1]];
                    saveWidgets(n);
                  }}
                >
                  <ArrowDown size={17} />
                </IconButton>
              </div>
            ))}
          </div>
          <Button
            secondary
            onClick={() => {
              saveWidgets(defaults);
              saveKpis(kpiDefaults);
              void action({
                action: "settings",
                data: {
                  dashboardTitle: "Дашборд",
                  dashboardSubtitle: "Всё важное — в одном месте.",
                },
              });
            }}
          >
            Вернуть исходный вид
          </Button>
        </Modal>
      )}
    </>
  );
}
