import { useMemo } from "react";
import { format } from "date-fns";
import { useApp, useData } from "../store";
import { Button, Card } from "./UI";
import { localDay } from "../../shared/smart-input";
import { dailyOverview, focusPlan } from "../../shared/daily";
import { remainingBudget } from "../../shared/finance-planning";
import { formatMoney } from "../../shared/calculations";
import { useNow } from "../hooks/useNow";
export default function DailyBrief() {
  const data = useData(),
    state = useApp((s) => s.state)!,
    now = useNow(),
    day = localDay(now),
    currency = state.settings.currency ?? "RUB";
  const plan = useMemo(() => focusPlan(data, now), [data, now]);
  const daily = useMemo(
    () => dailyOverview(data, day, currency),
    [data, day, currency],
  );
  const remaining = remainingBudget(data, currency);
  const evening = now.getHours() >= 18;
  return (
    <Card
      className="daily-brief"
      title={
        evening ? "Итоги дня" : now.getHours() < 12 ? "Доброе утро" : "Ваш день"
      }
      action={
        <Button
          onClick={async () => {
            try {
              await useApp
                .getState()
                .run({ action: "settings", data: { lastStartedDay: day } });
              useApp.getState().navigate("focus");
            } catch {
              /* toast */
            }
          }}
        >
          {state.settings.lastStartedDay === day
            ? "Вернуться к фокусу"
            : "Начать день"}
        </Button>
      }
    >
      {evening ? (
        <p>
          Задачи: {daily.completed} / {daily.total} · Расходы:{" "}
          {formatMoney(daily.expenses, currency)} · События: {daily.events} ·
          Заметки: {daily.notes}
          {daily.mainProject
            ? ` · Главный проект: ${daily.mainProject.name}`
            : ""}
        </p>
      ) : (
        <div className="brief-columns">
          <div>
            {plan.tasks.slice(0, 3).map((t) => (
              <button
                className="simple-row"
                key={t.id + t.due_date}
                onClick={() => useApp.getState().navigate("tasks", t.id)}
              >
                {t.title}
              </button>
            ))}
            {!plan.tasks.length && <p>Нет срочных задач</p>}
          </div>
          <div className="form-stack">
            <p>
              {plan.nextEvent
                ? `${format(plan.nextEvent.at, "d MMM HH:mm")} — ${plan.nextEvent.event.title}`
                : "Нет предстоящих событий"}
            </p>
            <p>Просрочено: {plan.overdue}</p>
            <p>
              {remaining === null
                ? "Месячный бюджет не задан"
                : `${formatMoney(remaining, currency)} осталось бюджета`}
            </p>
            {daily.mainProject && (
              <p>
                {daily.mainProject.name} — {daily.projectProgress}%
              </p>
            )}
          </div>
        </div>
      )}
      <button
        className="text-button"
        onClick={() => useApp.getState().navigate("timeline")}
      >
        Открыть историю дня →
      </button>
    </Card>
  );
}
