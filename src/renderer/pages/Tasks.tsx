import { useState, useMemo } from "react";
import VirtualList from "../components/VirtualList";
import {
  Plus,
  Search,
  LayoutList,
  Columns3,
  CalendarDays,
  Play,
  CheckCircle2,
  GripVertical,
} from "lucide-react";
import { useApp, useData, active, action } from "../store";
import {
  Badge,
  Button,
  Card,
  Empty,
  Heading,
  IconButton,
} from "../components/UI";
import { labels } from "../../shared/model";
import {
  tasksInRange,
  nextRecurrence,
  type TaskOccurrence,
} from "../../shared/recurrence";
import { localDay } from "../../shared/smart-input";
import { addDays, endOfDay } from "date-fns";
export default function Tasks() {
  const data = useData(),
    edit = useApp((s) => s.edit),
    selected = useApp((s) => s.selected);
  const [view, setView] = useState("list"),
    [query, setQuery] = useState(""),
    [project, setProject] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [due, setDue] = useState(""),
    [expanded, setExpanded] = useState(selected);
  const today = localDay();
  const occurrences = useMemo(() => {
    const end = endOfDay(addDays(new Date(today + "T12:00"), 7));
    const rows = tasksInRange(data, undefined, end);
    for (const task of data.tasks.filter(
      (t) => !t.deleted_at && t.recurrence_rule,
    )) {
      const next = nextRecurrence(task.due_date, task, new Date(+end + 1));
      if (next)
        rows.push(...tasksInRange({ ...data, tasks: [task] }, next, next));
    }
    return rows;
  }, [data, today]);
  const tasks = occurrences.filter(
    (t) =>
      (t.title + " " + t.description)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!project || t.project_id === project) &&
      (!status || t.status === status) &&
      (!priority || t.priority === priority) &&
      (!due ||
        (due === "today"
          ? t.due_date.slice(0, 10) === today
          : due === "overdue"
            ? t.due_date &&
              t.due_date.slice(0, 10) < today &&
              t.status !== "done"
            : t.due_date.slice(0, 10) >= today &&
              t.due_date.slice(0, 10) <=
                localDay(addDays(new Date(today + "T12:00"), 7)))),
  );
  const selectedTask = tasks.find((t) => t.id === expanded);
  const expandedKey = selectedTask
    ? selectedTask.id + selectedTask.due_date
    : expanded;
  function taskCard(task: TaskOccurrence) {
    const subtasks = active(data.subtasks).filter((s) => s.task_id === task.id);
    return (
      <div
        className={`task-row ${expandedKey === task.id + task.due_date ? "expanded" : ""}`}
        key={task.id + task.due_date}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", task.id);
          e.dataTransfer.setData(
            "application/task-occurrence",
            task.occurrence_date ?? "",
          );
        }}
      >
        <div className="task-main">
          <GripVertical className="muted" size={15} />
          <button
            className={`check ${task.status === "done" ? "checked" : ""}`}
            aria-label="Изменить выполнение"
            onClick={() =>
              void action(
                task.occurrence_date
                  ? {
                      action: "completeTask",
                      id: task.id,
                      occurrence_date: task.occurrence_date,
                      completed: task.status !== "done",
                    }
                  : {
                      action: "save",
                      table: "tasks",
                      data: {
                        ...task,
                        status: task.status === "done" ? "todo" : "done",
                      },
                    },
              )
            }
          >
            {task.status === "done" && <CheckCircle2 size={18} />}
          </button>
          <button
            className="task-title"
            onClick={() =>
              setExpanded(
                expanded === task.id + task.due_date
                  ? ""
                  : task.id + task.due_date,
              )
            }
          >
            <strong>{task.title}</strong>
            <small>
              {data.projects.find((p) => p.id === task.project_id)?.name ??
                "Без проекта"}
            </small>
          </button>
          <Badge status={task.priority} />
          <Badge status={task.status} />
          {task.due_date && (
            <small className="row">
              <CalendarDays size={13} />
              {task.due_date.replace("T", " ")}
              {task.recurrence_rule ? " ↻" : ""}
            </small>
          )}
          <IconButton
            label="Начать таймер"
            onClick={() =>
              void action(
                {
                  action: "timer",
                  command: "start",
                  task_id: task.id,
                  project_id: task.project_id,
                },
                "Таймер запущен",
              )
            }
          >
            <Play size={15} />
          </IconButton>
          <button
            className="text-button"
            onClick={() =>
              edit(
                "tasks",
                data.tasks.find((t) => t.id === task.id),
              )
            }
          >
            Изменить
          </button>
        </div>
        {expandedKey === task.id + task.due_date && (
          <div className="task-detail">
            {task.note_id &&
              data.notes.some(
                (n) => n.id === task.note_id && !n.deleted_at,
              ) && (
                <button
                  className="text-button"
                  onClick={() =>
                    useApp.getState().navigate("notes", task.note_id)
                  }
                >
                  Открыть связанную заметку
                </button>
              )}
            <p>
              {task.description || "Добавьте описание в настройках задачи."}
            </p>
            {subtasks.map((s) => (
              <label className="checkbox-row" key={s.id}>
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={() =>
                    void action({
                      action: "save",
                      table: "subtasks",
                      data: { ...s, done: !s.done },
                    })
                  }
                />
                {s.title}
                <button
                  className="text-button"
                  onClick={() =>
                    void action({
                      action: "remove",
                      table: "subtasks",
                      id: s.id,
                    })
                  }
                >
                  Удалить
                </button>
              </label>
            ))}
            <button
              className="text-button"
              onClick={() => edit("subtasks", undefined, { task_id: task.id })}
            >
              + Подзадача
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      <Heading
        title="Задачи"
        subtitle={`${active(data.tasks).filter((t) => t.status !== "done").length} активных задач · один шаг за другим`}
      >
        <Button
          secondary
          onClick={() =>
            void action({ action: "export", table: "tasks", format: "csv" })
          }
        >
          CSV
        </Button>
        <Button
          secondary
          onClick={() =>
            void action({ action: "export", table: "tasks", format: "json" })
          }
        >
          JSON
        </Button>
        <Button onClick={() => edit("tasks")}>
          <Plus size={17} />
          Новая задача
        </Button>
      </Heading>
      <div className="filters">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Найти задачу…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Проект"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="">Все проекты</option>
          {active(data.projects).map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Статус"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          {["todo", "in_progress", "pending", "done"].map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Приоритет"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">Все приоритеты</option>
          {["low", "medium", "high"].map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Срок"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        >
          <option value="">Все сроки</option>
          <option value="today">Сегодня</option>
          <option value="week">Неделя</option>
          <option value="overdue">Просрочено</option>
        </select>
        <div className="row">
          <IconButton
            label="Список"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <LayoutList size={19} />
          </IconButton>
          <IconButton
            label="Канбан"
            aria-pressed={view === "kanban"}
            onClick={() => setView("kanban")}
          >
            <Columns3 size={19} />
          </IconButton>
        </div>
      </div>
      {data.tasks.some((t) => t.recurrence_rule && !t.deleted_at) && (
        <p className="muted">
          Повторяющиеся задачи: вся история, следующие 7 дней и ближайший
          последующий повтор. Другие даты доступны в календаре. Редактирование
          меняет всю серию.
        </p>
      )}
      {!tasks.length ? (
        <Card>
          <Empty onCreate={() => edit("tasks")} />
        </Card>
      ) : view === "list" ? (
        <Card className="task-list">
          {<VirtualList items={tasks} render={taskCard} />}
        </Card>
      ) : (
        <div className="kanban">
          {["todo", "in_progress", "pending", "done"].map((s) => (
            <section
              key={s}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const task = data.tasks.find(
                  (t) => t.id === e.dataTransfer.getData("text/plain"),
                );
                if (!task) return;
                const day = e.dataTransfer.getData(
                  "application/task-occurrence",
                );
                if (task.recurrence_rule && day) {
                  const result = await action({
                    action: "completeTask",
                    id: task.id,
                    occurrence_date: day,
                    completed: s === "done",
                  });
                  if (!result || s === "done") return;
                }
                await action({
                  action: "save",
                  table: "tasks",
                  data: { id: task.id, status: s },
                });
              }}
            >
              <div className="card-heading">
                <h3>
                  {labels[s]}{" "}
                  <span className="muted">
                    {tasks.filter((t) => t.status === s).length}
                  </span>
                </h3>
                <IconButton
                  label="Добавить задачу"
                  onClick={() => edit("tasks", undefined, { status: s })}
                >
                  <Plus size={16} />
                </IconButton>
              </div>
              {tasks.filter((t) => t.status === s).map(taskCard)}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
