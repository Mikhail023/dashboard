import { useState } from "react";
import { addMonths } from "date-fns";
import { useApp, useData } from "../store";
import { Button, Card, Empty, Heading, Tabs } from "../components/UI";
import HabitPanel from "../components/HabitPanel";
import { localDay } from "../../shared/smart-input";
export default function Habits() {
  const data = useData(),
    selected = useApp((s) => s.selected),
    edit = useApp((s) => s.edit);
  const [months, setMonths] = useState<3 | 6 | 12>(12),
    [anchor, setAnchor] = useState(localDay()),
    [archived, setArchived] = useState(
      !!data.daily_goals.find((g) => g.id === selected)?.archived,
    );
  const goals = data.daily_goals
    .filter((g) => !g.deleted_at && g.archived === archived)
    .sort((a, b) => Number(b.id === selected) - Number(a.id === selected));
  return (
    <>
      <Heading
        title="Привычки"
        subtitle="Маленькие действия. Видимый прогресс."
      >
        <Button onClick={() => edit("daily_goals")}>Новая привычка</Button>
      </Heading>
      <div className="filters">
        <Tabs
          value={String(months)}
          onChange={(v) => setMonths(Number(v) as 3 | 6 | 12)}
          options={[
            ["3", "3 месяца"],
            ["6", "6 месяцев"],
            ["12", "Год"],
          ]}
        />
        <Button
          secondary
          aria-label="Предыдущий период привычек"
          onClick={() =>
            setAnchor(localDay(addMonths(new Date(anchor + "T12:00"), -months)))
          }
        >
          ←
        </Button>
        <strong>
          {months === 12
            ? anchor.slice(0, 4)
            : new Date(anchor + "T12:00").toLocaleDateString("ru-RU", {
                month: "long",
                year: "numeric",
              })}
        </strong>
        <Button
          secondary
          aria-label="Следующий период привычек"
          onClick={() =>
            setAnchor(localDay(addMonths(new Date(anchor + "T12:00"), months)))
          }
        >
          →
        </Button>
        <Button secondary onClick={() => setAnchor(localDay())}>
          Сегодня
        </Button>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Архив
        </label>
      </div>
      <div className="form-stack">
        {goals.map((goal) => (
          <Card key={goal.id} className="habit-card">
            <div className="habit-actions">
              {goal.project_id && (
                <button
                  className="text-button"
                  onClick={() =>
                    useApp.getState().navigate("projects", goal.project_id)
                  }
                >
                  {data.projects.find((p) => p.id === goal.project_id)?.name}
                </button>
              )}
              <Button secondary onClick={() => edit("daily_goals", goal)}>
                Настроить {goal.name}
              </Button>
            </div>
            <HabitPanel goal={goal} months={months} anchor={anchor} />
          </Card>
        ))}
        {!goals.length && (
          <Card>
            <Empty
              text={
                archived
                  ? "В архиве пока нет привычек"
                  : "Начните с одной привычки"
              }
              onCreate={() => edit("daily_goals")}
            />
          </Card>
        )}
      </div>
    </>
  );
}
