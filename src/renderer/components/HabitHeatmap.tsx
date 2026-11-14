import { useValueFeedback } from "../animation/useValueFeedback";
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
  name,
  targetValue,
  unit,
  startDate,
  outside,
  today,
  onSelect,
}: {
  day: string;
  value: number;
  name: string;
  targetValue: number;
  unit: string;
  startDate: string;
  outside: boolean;
  today: string;
  onSelect: (day: string) => void;
}) {
  const progress = habitProgress(value, targetValue);
  const ref = useValueFeedback<HTMLButtonElement>(value, progress >= 1);
  const text = `${format(new Date(day + "T12:00"), "d MMMM yyyy", { locale: ru })}\n${name}\n${formatHabitValue(value, unit)} / ${formatHabitValue(targetValue, unit)}\n${Math.floor(progress * 100)}%`;
  return (
    <button
      ref={ref}
      type="button"
      className={`habit-tile ${outside ? "outside" : ""}`}
      data-day={day}
      data-level={habitLevel(progress)}
      disabled={outside || day > today || day < startDate}
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
              name={goal.name}
              targetValue={goal.target_value}
              unit={goal.unit}
              startDate={goal.start_date}
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
