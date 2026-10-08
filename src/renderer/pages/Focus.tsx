import { useMemo } from "react";
import { format } from "date-fns";
import { useApp, useData, action } from "../store";
import { Button, Card, Heading } from "../components/UI";
import { focusPlan, dailyOverview } from "../../shared/daily";
import { localDay } from "../../shared/smart-input";
import { useNow } from "../hooks/useNow";
export default function Focus() {
  const data = useData(),
    now = useNow(),
    day = localDay(now);
  const plan = useMemo(() => focusPlan(data, now), [data, now]),
    daily = useMemo(() => dailyOverview(data, day), [data, day]);
  const task = plan.tasks[0],
    percent = daily.total
      ? Math.min(100, Math.round((daily.completed / daily.total) * 100))
      : 0;
  return (
    <>
      <Heading title="Фокус" subtitle="Одна главная задача сейчас">
        <Button
          secondary
          onClick={() => useApp.getState().navigate("dashboard")}
        >
          На дашборд
        </Button>
      </Heading>
      <div className="focus-layout">
        <Card title="Главная задача">
          {task ? (
            <div className="form-stack">
              <h1>{task.title}</h1>
              <p>{task.description}</p>
              <small className="muted">
                {task.due_date.replace("T", " ") || "Без срока"}
              </small>
              <Button
                onClick={() =>
                  void action(
                    task.occurrence_date
                      ? {
                          action: "completeTask",
                          id: task.id,
                          occurrence_date: task.occurrence_date,
                          completed: true,
                        }
                      : {
                          action: "save",
                          table: "tasks",
                          data: { id: task.id, status: "done" },
                        },
                  )
                }
              >
                Завершить задачу
              </Button>
              <button
                className="text-button"
                onClick={() =>
                  useApp.getState().edit(
                    "tasks",
                    data.tasks.find((t) => t.id === task.id),
                  )
                }
              >
                Открыть задачу
              </button>
            </div>
          ) : (
            <p>Главные задачи завершены. Можно выдохнуть.</p>
          )}
        </Card>
        <Card title="Следующие задачи">
          {plan.tasks.slice(1, 4).map((t) => (
            <button
              key={t.id + t.due_date}
              className="simple-row"
              onClick={() =>
                useApp.getState().edit(
                  "tasks",
                  data.tasks.find((m) => m.id === t.id),
                )
              }
            >
              {t.title}
            </button>
          ))}
          {plan.tasks.length < 2 && <p className="muted">Очередь свободна</p>}
        </Card>
        <Card title="Ближайшее событие">
          {plan.nextEvent ? (
            <button
              className="simple-row"
              onClick={() =>
                useApp.getState().edit("events", plan.nextEvent.event)
              }
            >
              {format(plan.nextEvent.at, "d MMM HH:mm")} ·{" "}
              {plan.nextEvent.event.title}
            </button>
          ) : (
            <p>Нет событий</p>
          )}
        </Card>
        <Card title="Прогресс дня">
          <strong className="big-number">{percent}%</strong>
          <p>
            {daily.completed} / {daily.total} задач
          </p>
          <div className="progress">
            <i style={{ width: `${percent}%` }} />
          </div>
        </Card>
      </div>
    </>
  );
}
