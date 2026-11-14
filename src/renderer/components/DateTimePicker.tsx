import { useState } from "react";
import {
  addDays,
  addMonths,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

type Props = { value: string; onChange: (value: string) => void; name: string };

function asDate(value: string) {
  const date = value ? parseISO(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export default function DateTimePicker({ value, onChange, name }: Props) {
  const selected = asDate(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(selected));
  const days = Array.from({ length: 42 }, (_, i) =>
    addDays(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), i),
  );
  const dateValue = value.split("T")[0] || format(selected, "yyyy-MM-dd");
  const timeValue = value.split("T")[1]?.slice(0, 5) || "09:00";
  const update = (date: Date, time = timeValue) =>
    onChange(`${format(date, "yyyy-MM-dd")}T${time || "09:00"}`);

  return (
    <div className="datetime-picker">
      <div className="datetime-trigger-row">
        <button
          className="datetime-trigger"
          type="button"
          aria-expanded={open}
          aria-label="Выбрать дату и время"
          onClick={() => setOpen((current) => !current)}
        >
          <CalendarDays size={16} />
          {format(selected, "d MMMM yyyy", { locale: ru })}
        </button>
        <label className="datetime-time">
          <Clock3 size={15} />
          <input
            aria-label="Время"
            type="time"
            value={timeValue}
            onChange={(event) => update(selected, event.target.value)}
          />
        </label>
        <input type="hidden" name={name} value={value} />
      </div>
      {open && (
        <div className="date-popover" role="group" aria-label="Календарь">
          <div className="date-popover-header">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onClick={() => setMonth((current) => subMonths(current, 1))}
            >
              <ChevronLeft size={17} />
            </button>
            <strong>{format(month, "LLLL yyyy", { locale: ru })}</strong>
            <button
              type="button"
              aria-label="Следующий месяц"
              onClick={() => setMonth((current) => addMonths(current, 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="date-grid" role="grid">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
              <span className="date-weekday" key={day}>
                {day}
              </span>
            ))}
            {days.map((day) => {
              const selectedDay = format(day, "yyyy-MM-dd") === dateValue;
              return (
                <button
                  aria-label={format(day, "d MMMM yyyy", { locale: ru })}
                  aria-pressed={selectedDay}
                  className={`date-cell ${!isSameMonth(day, month) ? "outside" : ""} ${selectedDay ? "selected" : ""}`}
                  key={format(day, "yyyy-MM-dd")}
                  type="button"
                  onClick={() => {
                    update(day);
                    setOpen(false);
                  }}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
          <button
            className="date-today"
            type="button"
            onClick={() => {
              const today = new Date();
              setMonth(startOfMonth(today));
              update(today);
              setOpen(false);
            }}
          >
            Сегодня
          </button>
        </div>
      )}
    </div>
  );
}
