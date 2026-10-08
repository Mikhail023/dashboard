import { GoalDayDialog } from "../components/HabitPanel";
import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { useApp, useData } from "../store";
import { dailyOverview } from "../../shared/daily";
import { localDay } from "../../shared/smart-input";
import { formatMoney } from "../../shared/calculations";
import { Button, Card, Heading, Stat } from "../components/UI";
export default function Timeline() {
  const data = useData(),
    currency = useApp((s) => s.state?.settings.currency) ?? "RUB";
  const [entryId, setEntryId] = useState("");
  const entry = data.daily_goal_entries.find((e) => e.id === entryId),
    goal = entry && data.daily_goals.find((g) => g.id === entry.goal_id);
  const [day, setDay] = useState(localDay());
  const overview = useMemo(
    () => dailyOverview(data, day, currency),
    [data, day, currency],
  );
  return (
    <>
      <Heading
        title="История дня"
        subtitle="Задачи, заметки, встречи и операции в одном дне"
      >
        <Button secondary onClick={() => setDay(localDay())}>
          Сегодня
        </Button>
      </Heading>
      <div className="filters">
        <Button
          secondary
          onClick={() =>
            setDay(localDay(addDays(new Date(day + "T12:00"), -1)))
          }
        >
          ← День
        </Button>
        <input
          type="date"
          aria-label="День истории"
          value={day}
          onChange={(e) => {
            if (e.target.value) setDay(e.target.value);
          }}
        />
        <Button
          secondary
          onClick={() => setDay(localDay(addDays(new Date(day + "T12:00"), 1)))}
        >
          День →
        </Button>
      </div>
      <div className="stats-grid">
        <Stat
          label="Задачи выполнены"
          value={`${overview.completed} / ${overview.total}`}
          caption="По срокам и отметкам выполнения"
        />
        <Stat label="События" value={overview.events} caption="По расписанию" />
        <Stat
          label="Заметки"
          value={overview.notes}
          caption="Создано в этот день"
        />
        <Stat
          label="Расходы"
          value={formatMoney(overview.expenses, currency)}
          caption={currency}
        />
      </div>
      {overview.mainProject && (
        <Button
          secondary
          onClick={() =>
            useApp.getState().navigate("projects", overview.mainProject!.id)
          }
        >
          Главный проект: {overview.mainProject.name} ·{" "}
          {overview.projectProgress}%
        </Button>
      )}
      <Card
        title={new Date(day + "T12:00").toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      >
        {overview.items.map((item) => (
          <button
            className="simple-row timeline-item"
            key={item.key}
            onClick={() => {
              if (item.table === "daily_goal_entries") setEntryId(item.id);
              else if (item.table === "notes")
                useApp.getState().navigate("notes", item.id);
              else
                useApp.getState().edit(
                  item.table,
                  data[item.table].find((r) => r.id === item.id),
                );
            }}
          >
            <time>
              {item.unknownTime
                ? "Весь день"
                : format(new Date(item.time), "HH:mm")}
            </time>
            <span>
              <strong>{item.title}</strong>
              <small className="block muted">
                {item.label}
                {item.project_id
                  ? ` · ${data.projects.find((p) => p.id === item.project_id)?.name ?? ""}`
                  : ""}
              </small>
            </span>
            {item.amount !== undefined && (
              <span>{formatMoney(item.amount, item.currency)}</span>
            )}
          </button>
        ))}
        {!overview.items.length && (
          <p className="muted">В этот день нет записей.</p>
        )}
      </Card>
      {entry && goal && (
        <GoalDayDialog
          goal={goal}
          day={entry.day}
          onClose={() => setEntryId("")}
        />
      )}
    </>
  );
}
