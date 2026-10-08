import { useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp, useData, active, action } from "../store";
import { occurrences } from "../../shared/calculations";
import { tasksInRange } from "../../shared/recurrence";
import { Button, Heading, IconButton, Tabs } from "../components/UI";
export default function Calendar() {
  const data = useData(),
    edit = useApp((s) => s.edit),
    weekStart = Number(useApp((s) => s.state?.settings.weekStart) ?? 1) as
      0 | 1;
  const [date, setDate] = useState(new Date()),
    [view, setView] = useState("month");
  const from =
    view === "month"
      ? startOfWeek(startOfMonth(date), { weekStartsOn: weekStart })
      : view === "week"
        ? startOfWeek(date, { weekStartsOn: weekStart })
        : new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const to =
    view === "month"
      ? endOfWeek(endOfMonth(date), { weekStartsOn: weekStart })
      : view === "week"
        ? endOfWeek(date, { weekStartsOn: weekStart })
        : endOfDay(from);
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const events = active(data.events).flatMap((e) =>
    occurrences(e, from, to).map((d) => ({ event: e, date: d })),
  );
  const tasks = tasksInRange(data, from, to);
  const move = (direction: number) =>
    setDate(
      view === "month"
        ? addMonths(date, direction)
        : view === "week"
          ? addWeeks(date, direction)
          : addDays(date, direction),
    );
  return (
    <>
      <Heading title="Календарь" subtitle="Найдите время для важного">
        <Button
          onClick={() =>
            edit("events", undefined, {
              start_at: format(date, "yyyy-MM-dd'T'09:00"),
              end_at: format(date, "yyyy-MM-dd'T'10:00"),
            })
          }
        >
          <Plus size={17} />
          Новое событие
        </Button>
      </Heading>
      <div className="calendar-toolbar">
        <div className="row">
          <IconButton label="Назад" onClick={() => move(-1)}>
            <ChevronLeft size={19} />
          </IconButton>
          <h2>
            {format(date, view === "day" ? "d MMMM yyyy" : "LLLL yyyy", {
              locale: ru,
            })}
          </h2>
          <IconButton label="Вперёд" onClick={() => move(1)}>
            <ChevronRight size={19} />
          </IconButton>
          <Button secondary onClick={() => setDate(new Date())}>
            Сегодня
          </Button>
        </div>
        <Tabs
          value={view}
          onChange={setView}
          options={[
            ["month", "Месяц"],
            ["week", "Неделя"],
            ["day", "День"],
          ]}
        />
      </div>
      <div className={`calendar ${view}`}>
        <div className="calendar-weekdays">
          {(view === "day" ? [date] : days.slice(0, 7)).map((d) => (
            <span key={String(d)}>{format(d, "EEEE", { locale: ru })}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {days.map((d) => (
            <div
              key={String(d)}
              className={`calendar-day ${!isSameMonth(d, date) ? "outside" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const event = data.events.find(
                  (ev) => ev.id === e.dataTransfer.getData("text/plain"),
                );
                if (event) {
                  const old = new Date(event.start_at),
                    next = new Date(d);
                  next.setHours(old.getHours(), old.getMinutes());
                  const end = new Date(
                    +next + (+new Date(event.end_at) - +old),
                  );
                  void action({
                    action: "save",
                    table: "events",
                    data: {
                      ...event,
                      start_at: format(next, "yyyy-MM-dd'T'HH:mm"),
                      end_at: format(end, "yyyy-MM-dd'T'HH:mm"),
                    },
                  });
                }
              }}
            >
              <button
                className={`day-number ${isSameDay(d, new Date()) ? "today" : ""}`}
                aria-label={`Добавить событие ${format(d, "d MMMM", { locale: ru })}`}
                onClick={() =>
                  edit("events", undefined, {
                    start_at: format(d, "yyyy-MM-dd'T'09:00"),
                    end_at: format(d, "yyyy-MM-dd'T'10:00"),
                  })
                }
              >
                {format(d, "d")}
              </button>
              {events
                .filter((e) => isSameDay(e.date, d))
                .map(({ event, date: occ }) => (
                  <button
                    key={event.id + String(occ)}
                    className="calendar-event"
                    style={{ borderLeftColor: event.color }}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", event.id)
                    }
                    onClick={() => edit("events", event)}
                  >
                    <small>
                      {event.all_day ? "Весь день" : format(occ, "HH:mm")}
                      {event.recurrence_rule ? " ↻" : ""}
                    </small>
                    <strong>{event.title}</strong>
                  </button>
                ))}
              {tasks
                .filter(
                  (t) => t.due_date.slice(0, 10) === format(d, "yyyy-MM-dd"),
                )
                .map((t) => (
                  <div className="row" key={t.id + t.due_date}>
                    <input
                      type="checkbox"
                      aria-label={`Выполнить ${t.title} ${format(d, "yyyy-MM-dd")}`}
                      checked={t.status === "done"}
                      onChange={() =>
                        void action(
                          t.occurrence_date
                            ? {
                                action: "completeTask",
                                id: t.id,
                                occurrence_date: t.occurrence_date,
                                completed: t.status !== "done",
                              }
                            : {
                                action: "save",
                                table: "tasks",
                                data: {
                                  id: t.id,
                                  status: t.status === "done" ? "todo" : "done",
                                },
                              },
                        )
                      }
                    />
                    <button
                      className="calendar-task"
                      onClick={() =>
                        edit(
                          "tasks",
                          data.tasks.find((master) => master.id === t.id),
                        )
                      }
                    >
                      ◇ {t.title}
                      {t.recurrence_rule ? " ↻" : ""}
                    </button>
                  </div>
                ))}
              {view !== "month" &&
                Array.from({ length: 10 }, (_, i) => (
                  <button
                    key={i}
                    className="time-slot"
                    onClick={() =>
                      edit("events", undefined, {
                        start_at: format(
                          d,
                          `yyyy-MM-dd'T'${String(i + 9).padStart(2, "0")}:00`,
                        ),
                        end_at: format(
                          d,
                          `yyyy-MM-dd'T'${String(i + 10).padStart(2, "0")}:00`,
                        ),
                      })
                    }
                  >
                    {i + 9}:00
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
