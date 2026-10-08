import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowLeft,
  CalendarDays,
  Clock,
  LayoutGrid,
  List,
} from "lucide-react";
import { useApp, useData, active, action } from "../store";
import { progress, invoiceTotal, formatMoney } from "../../shared/calculations";
import {
  Badge,
  Button,
  Card,
  Empty,
  Heading,
  IconButton,
  Tabs,
} from "../components/UI";
export default function Projects() {
  const data = useData(),
    edit = useApp((s) => s.edit),
    selected = useApp((s) => s.selected),
    navigate = useApp((s) => s.navigate);
  const [tab, setTab] = useState("tasks"),
    [status, setStatus] = useState(""),
    [view, setView] = useState("grid");
  const project = data.projects.find((p) => p.id === selected && !p.deleted_at),
    tasks = active(data.tasks).filter((t) => t.project_id === selected);
  if (project)
    return (
      <>
        <button
          className="text-button row"
          onClick={() => navigate("projects")}
        >
          <ArrowLeft size={16} />
          Все проекты
        </button>
        <Heading
          title={project.name}
          subtitle={project.description || "Всё, что связано с проектом"}
        >
          <Button
            secondary
            onClick={() =>
              void action({
                action: "export",
                table: "projects",
                id: project.id,
                format: "json",
              })
            }
          >
            JSON
          </Button>
          <Button secondary onClick={() => edit("projects", project)}>
            Изменить проект
          </Button>
        </Heading>
        <div className="stats-grid">
          <Card title="Прогресс">
            <strong className="big-number">{progress(tasks)}%</strong>
            <div className="progress">
              <i style={{ width: `${progress(tasks)}%` }} />
            </div>
          </Card>
          <Card title="Задачи">
            <strong className="big-number">
              {tasks.filter((t) => t.status === "done").length} / {tasks.length}
            </strong>
          </Card>
          <Card title="Затрачено времени">
            <strong className="big-number">
              {(
                active(data.time_entries)
                  .filter((t) => t.project_id === project.id)
                  .reduce((s, t) => s + t.seconds, 0) / 3600
              ).toFixed(1)}{" "}
              ч
            </strong>
          </Card>
          <Card title="Статус">
            <Badge status={project.status} />
            <p>{project.due_date || "Без дедлайна"}</p>
          </Card>
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            ["tasks", "Задачи"],
            ["notes", "Заметки"],
            ["events", "События"],
            ["finance", "Финансы"],
            ["habits", "Привычки"],
          ]}
        />
        <Card>
          {tab === "tasks" ? (
            <>
              <Button
                secondary
                onClick={() =>
                  edit("tasks", undefined, { project_id: project.id })
                }
              >
                <Plus size={16} />
                Добавить задачу
              </Button>
              {tasks.map((t) => (
                <button
                  className="simple-row"
                  key={t.id}
                  onClick={() => edit("tasks", t)}
                >
                  {t.title}
                  <Badge status={t.status} />
                </button>
              ))}
            </>
          ) : tab === "habits" ? (
            <>
              <Button
                secondary
                onClick={() =>
                  edit("daily_goals", undefined, { project_id: project.id })
                }
              >
                Добавить привычку
              </Button>
              {active(data.daily_goals)
                .filter((g) => g.project_id === project.id)
                .map((g) => (
                  <button
                    key={g.id}
                    className="simple-row"
                    onClick={() => navigate("habits", g.id)}
                  >
                    {g.name}
                    <ArrowUpRight size={16} />
                  </button>
                ))}
            </>
          ) : tab === "notes" ? (
            <>
              <Button
                secondary
                onClick={() =>
                  edit("notes", undefined, { project_id: project.id })
                }
              >
                Добавить заметку
              </Button>
              {active(data.notes)
                .filter((n) => n.project_id === project.id)
                .map((n) => (
                  <button
                    className="simple-row"
                    key={n.id}
                    onClick={() => navigate("notes", n.id)}
                  >
                    {n.title}
                    <ArrowUpRight size={16} />
                  </button>
                ))}
            </>
          ) : tab === "events" ? (
            <>
              <Button
                secondary
                onClick={() =>
                  edit("events", undefined, { project_id: project.id })
                }
              >
                Добавить событие
              </Button>
              {active(data.events)
                .filter((e) => e.project_id === project.id)
                .map((e) => (
                  <button
                    className="simple-row"
                    key={e.id}
                    onClick={() => edit("events", e)}
                  >
                    {e.title}
                    <span>{new Date(e.start_at).toLocaleString("ru-RU")}</span>
                  </button>
                ))}
            </>
          ) : (
            <>
              <h3>Операции</h3>
              <Button
                secondary
                onClick={() =>
                  edit("transactions", undefined, { project_id: project.id })
                }
              >
                Добавить операцию
              </Button>
              {active(data.transactions)
                .filter((t) => t.project_id === project.id)
                .map((t) => (
                  <button
                    className="simple-row"
                    key={t.id}
                    onClick={() => edit("transactions", t)}
                  >
                    <span>{t.note}</span>
                    <Badge status={t.type} />
                    <strong>
                      {formatMoney(
                        t.amount,
                        data.accounts.find((a) => a.id === t.account_id)
                          ?.currency,
                      )}
                    </strong>
                  </button>
                ))}
              <h3>Счета-фактуры</h3>
              {active(data.invoices)
                .filter((i) => i.project_id === project.id)
                .map((i) => (
                  <button
                    className="simple-row"
                    key={i.id}
                    onClick={() => navigate("finance", i.id)}
                  >
                    {i.number}
                    <Badge status={i.status} />
                    {formatMoney(invoiceTotal(data, i.id), i.currency)}
                  </button>
                ))}
            </>
          )}
        </Card>
      </>
    );
  const projects = active(data.projects).filter(
    (p) => !status || p.status === status,
  );
  return (
    <>
      <Heading
        title="Проекты"
        subtitle="Большие цели складываются из небольших шагов"
      >
        <Button
          secondary
          onClick={() =>
            void action({ action: "export", table: "projects", format: "json" })
          }
        >
          Экспорт JSON
        </Button>
        <Button onClick={() => edit("projects")}>
          <Plus size={17} />
          Добавить проект
        </Button>
      </Heading>
      <div className="filters">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            ["", "Все проекты"],
            ["running", "В работе"],
            ["pending", "Ожидают"],
            ["ended", "Завершены"],
          ]}
        />
        <div className="row">
          <IconButton label="Карточки" onClick={() => setView("grid")}>
            <LayoutGrid size={18} />
          </IconButton>
          <IconButton label="Таблица" onClick={() => setView("list")}>
            <List size={18} />
          </IconButton>
        </div>
      </div>
      {!projects.length ? (
        <Card>
          <Empty onCreate={() => edit("projects")} />
        </Card>
      ) : (
        <div className={view === "grid" ? "project-grid" : "project-table"}>
          {projects.map((p) => {
            const pt = active(data.tasks).filter((t) => t.project_id === p.id);
            return (
              <button
                key={p.id}
                className="card project-card"
                onClick={() => navigate("projects", p.id)}
              >
                <div className="card-heading">
                  <span className="project-icon" style={{ color: p.color }}>
                    {p.name.slice(0, 1)}
                  </span>
                  <ArrowUpRight size={18} />
                </div>
                <h2>{p.name}</h2>
                <p>{p.description || "Новый проект — новые возможности"}</p>
                <Badge status={p.status} />
                <div className="progress-label">
                  <span>
                    {pt.filter((t) => t.status === "done").length} из{" "}
                    {pt.length} задач
                  </span>
                  <strong>{progress(pt)}%</strong>
                </div>
                <div className="progress">
                  <i
                    style={{ width: `${progress(pt)}%`, background: p.color }}
                  />
                </div>
                <div className="project-bottom">
                  <span>
                    <CalendarDays size={14} />
                    {p.due_date || "Без срока"}
                  </span>
                  <span>
                    <Clock size={14} />
                    {(
                      active(data.time_entries)
                        .filter((e) => e.project_id === p.id)
                        .reduce((s, e) => s + e.seconds, 0) / 3600
                    ).toFixed(1)}{" "}
                    ч
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
