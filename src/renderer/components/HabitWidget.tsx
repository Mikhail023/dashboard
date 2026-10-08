import { useApp, useData, action } from "../store";
import { Empty } from "./UI";
import HabitPanel from "./HabitPanel";
export default function HabitWidget({ size }: { size: string }) {
  const data = useData(),
    selected = useApp((s) => s.state?.settings.dashboardGoal);
  const goals = data.daily_goals.filter((g) => !g.deleted_at && !g.archived);
  const goal = goals.find((g) => g.id === selected) ?? goals[0];
  if (!goal)
    return (
      <Empty
        text="Один маленький шаг каждый день"
        onCreate={() => useApp.getState().edit("daily_goals")}
      />
    );
  return (
    <div className="form-stack">
      <select
        aria-label="Привычка на дашборде"
        value={goal.id}
        onChange={(e) =>
          void action({
            action: "settings",
            data: { dashboardGoal: e.target.value },
          })
        }
      >
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <HabitPanel goal={goal} size={size} />
      <button
        className="text-button"
        onClick={() => useApp.getState().navigate("habits", goal.id)}
      >
        Все привычки →
      </button>
    </div>
  );
}
