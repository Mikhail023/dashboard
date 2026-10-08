import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { addDays } from "date-fns";
import {
  Target,
  GraduationCap,
  Dumbbell,
  BookOpen,
  Droplets,
  Sparkles,
  Flame,
} from "lucide-react";
import type { Row } from "../../shared/model";
import {
  formatHabitValue,
  goalEntries,
  habitDay,
  habitLevel,
  habitProgress,
  habitStats,
} from "../../shared/habits";
import { localDay } from "../../shared/smart-input";
import { useApp, useData } from "../store";
import { Button, Modal } from "./UI";
import HabitHeatmap from "./HabitHeatmap";
import { useNow } from "../hooks/useNow";
export const habitIcons = {
  target: Target,
  study: GraduationCap,
  sport: Dumbbell,
  reading: BookOpen,
  water: Droplets,
  sparkles: Sparkles,
};
export function GoalDayDialog({
  goal,
  day: initialDay,
  onClose,
}: {
  goal: Row<"daily_goals">;
  day: string;
  onClose: () => void;
}) {
  const data = useData();
  const entries = useMemo(
    () => goalEntries(data.daily_goal_entries, goal.id),
    [data.daily_goal_entries, goal.id],
  );
  const [day, setDay] = useState(initialDay),
    [value, setValue] = useState(entries.get(initialDay)?.value ?? 0),
    [busy, setBusy] = useState(false);
  const ratio = habitProgress(value, goal.target_value);
  return (
    <Modal title={goal.name + " · прогресс дня"} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            await useApp
              .getState()
              .run({
                action: "recordGoal",
                goal_id: goal.id,
                day,
                value,
                mode: "set",
              });
            onClose();
          } catch {
            /* existing toast */
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          День привычки
          <input
            type="date"
            required
            min={goal.start_date}
            max={localDay()}
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setValue(entries.get(e.target.value)?.value ?? 0);
            }}
          />
        </label>
        {goal.kind === "boolean" ? (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={value >= 1}
              onChange={(e) => setValue(e.target.checked ? 1 : 0)}
            />
            Выполнено
          </label>
        ) : (
          <label>
            Значение за день ({goal.unit})
            <input
              type="number"
              min="0"
              max="1000000000"
              step="any"
              required
              value={Number.isFinite(value) ? value : ""}
              onChange={(e) => setValue(e.target.valueAsNumber)}
            />
          </label>
        )}
        <p>
          {formatHabitValue(Number.isFinite(value) ? value : 0, goal.unit)} /{" "}
          {formatHabitValue(goal.target_value, goal.unit)} ·{" "}
          {Number.isFinite(ratio) ? Math.floor(ratio * 100) : 0}%
        </p>
        <small className="muted">
          Сохраняется итог за выбранный день. Прошлые дни можно исправлять.
        </small>
        <div className="form-actions">
          <Button type="button" secondary onClick={() => setValue(0)}>
            Сбросить день
          </Button>
          <Button type="button" secondary onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy}>Сохранить прогресс</Button>
        </div>
      </form>
    </Modal>
  );
}
export default function HabitPanel({
  goal,
  size = "L",
  months = 12,
  anchor,
}: {
  goal: Row<"daily_goals">;
  size?: string;
  months?: 3 | 6 | 12;
  anchor?: string;
}) {
  const data = useData(),
    today = localDay(useNow());
  const entries = useMemo(
    () => goalEntries(data.daily_goal_entries, goal.id),
    [data.daily_goal_entries, goal.id],
  );
  const stats = useMemo(
    () => habitStats(goal, entries, today),
    [goal, entries, today],
  );
  const [selectedDay, setSelectedDay] = useState("");
  const selectDay = useCallback((day: string) => setSelectedDay(day), []),
    close = useCallback(() => setSelectedDay(""), []);
  const value = entries.get(today)?.value ?? 0,
    ratio = habitProgress(value, goal.target_value),
    Icon = habitIcons[goal.icon];
  return (
    <div
      className={`habit-panel habit-${size}`}
      style={
        { "--habit-color": goal.color || "var(--primary)" } as CSSProperties
      }
    >
      <div className="habit-heading">
        <span className="habit-icon">
          <Icon size={20} />
        </span>
        <strong>{goal.name}</strong>
        <span className="habit-streak" title="Текущая серия">
          <Flame size={16} />
          {stats.current} дн.
        </span>
      </div>
      {size === "S" ? (
        <div className="habit-mini">
          {Array.from({ length: 14 }, (_, i) =>
            habitDay(addDays(new Date(today + "T12:00"), i - 13)),
          ).map((day) => (
            <button
              type="button"
              key={day}
              className="habit-tile"
              data-day={day}
              data-level={habitLevel(
                habitProgress(entries.get(day)?.value ?? 0, goal.target_value),
              )}
              disabled={day < goal.start_date}
              title={`${day} · ${formatHabitValue(entries.get(day)?.value ?? 0, goal.unit)}`}
              aria-label={`${goal.name} ${day}`}
              onClick={() => selectDay(day)}
            >
              {(entries.get(day)?.value ?? 0) > goal.target_value && (
                <span className="habit-over" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <>
          <HabitHeatmap
            goal={goal}
            entries={entries}
            today={today}
            months={size === "M" ? 3 : months}
            anchor={anchor ?? today}
            onSelect={selectDay}
          />
          {size === "L" && (
            <div className="habit-stats">
              <div>
                <strong>{stats.current}</strong>
                <small>Текущая серия</small>
              </div>
              <div>
                <strong>{stats.longest}</strong>
                <small>Лучшая серия</small>
              </div>
              <div>
                <strong>{stats.completionRate}%</strong>
                <small>Выполнение с начала</small>
              </div>
              <div>
                <strong>{stats.completedDays}</strong>
                <small>Выполнено дней</small>
              </div>
            </div>
          )}
          <div className="habit-today">
            <div>
              <small className="muted">Сегодня</small>
              <p>
                {formatHabitValue(value, goal.unit)} /{" "}
                {formatHabitValue(goal.target_value, goal.unit)}
              </p>
            </div>
            <Button
              secondary
              disabled={today < goal.start_date || goal.archived}
              onClick={() => selectDay(today)}
            >
              {Math.floor(ratio * 100)}% · Изменить
            </Button>
          </div>
          <div className="progress habit-progress">
            <i style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
        </>
      )}
      {selectedDay && (
        <GoalDayDialog
          key={selectedDay}
          goal={goal}
          day={selectedDay}
          onClose={close}
        />
      )}
    </div>
  );
}
