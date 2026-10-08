import { memo, useMemo, type CSSProperties } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { Row } from "../../shared/model";
import {
  formatHabitValue,
  habitLevel,
  habitProgress,
  heatmapRange,
} from "../../shared/habits";
const Tile = memo(function Tile({
  day,
  value,
  goal,
  outside,
  today,
  onSelect,
}: {
  day: string;
  value: number;
  goal: Row<"daily_goals">;
  outside: boolean;
  today: string;
  onSelect: (day: string) => void;
}) {
  const progress = habitProgress(value, goal.target_value);
  const text = `${format(new Date(day + "T12:00"), "d MMMM yyyy", { locale: ru })}\n${goal.name}\n${formatHabitValue(value, goal.unit)} / ${formatHabitValue(goal.target_value, goal.unit)}\n${Math.floor(progress * 100)}%`;
  return (
    <button
      type="button"
      className={`habit-tile ${outside ? "outside" : ""}`}
      data-day={day}
      data-level={habitLevel(progress)}
      disabled={outside || day > today || day < goal.start_date}
      title={text}
      aria-label={text}
      aria-current={day === today ? "date" : undefined}
      onClick={() => onSelect(day)}
    >
      {progress > 1 && <span className="habit-over" aria-hidden="true" />}
    </button>
  );
});
export default memo(function HabitHeatmap({
  goal,
  entries,
  today,
  months = 3,
  anchor = today,
  onSelect,
}: {
  goal: Row<"daily_goals">;
  entries: Map<string, Row<"daily_goal_entries">>;
  today: string;
  months?: 3 | 6 | 12;
  anchor?: string;
  onSelect: (day: string) => void;
}) {
  const range = useMemo(() => heatmapRange(months, anchor), [months, anchor]);
  const weeks = range.cells.length / 7;
  const labels = useMemo(
    () =>
      range.cells.flatMap((cell, index) =>
        !cell.outside && (cell.day.endsWith("-01") || cell.day === range.from)
          ? [
              {
                column: Math.floor(index / 7) + 1,
                label: format(new Date(cell.day + "T12:00"), "LLL", {
                  locale: ru,
                }),
              },
            ]
          : [],
      ),
    [range],
  );
  return (
    <div
      className="habit-heatmap"
      style={
        {
          "--habit-color": goal.color || "var(--primary)",
          "--habit-weeks": weeks,
        } as CSSProperties
      }
    >
      <div className="habit-calendar-scroll">
        <div className="habit-months">
          {labels.map((month) => (
            <span
              key={month.column}
              style={{ gridColumn: `${month.column} / span 3` }}
            >
              {month.label}
            </span>
          ))}
        </div>
        <div
          className="habit-cells"
          aria-label={`Активность ${goal.name}: ${range.from} — ${range.to}`}
        >
          {range.cells.map((cell) => (
            <Tile
              key={cell.day}
              {...cell}
              value={entries.get(cell.day)?.value ?? 0}
              goal={goal}
              today={today}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
      <div className="habit-legend">
        <span>Меньше</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i className="habit-tile" key={level} data-level={level}>
            {level === 4 && <span className="habit-over" />}
          </i>
        ))}
        <span>Больше</span>
      </div>
    </div>
  );
});
