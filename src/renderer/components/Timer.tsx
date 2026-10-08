import { useState, useEffect } from "react";
import { Play, Pause, Square, Timer as TimerIcon } from "lucide-react";
import { useApp, useData, active, action } from "../store";
import { localDay } from "../../shared/smart-input";
import { IconButton } from "./UI";
export default function Timer({ size = "M" }: { size?: string }) {
  const timer = useApp((s) => s.state?.timer),
    data = useData();
  const [taskId, setTaskId] = useState(timer?.task_id ?? ""),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timer?.running_since) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer?.running_since]);
  const seconds =
    (timer?.elapsed ?? 0) +
    (timer?.running_since
      ? Math.max(0, Math.floor((now - timer.running_since) / 1000))
      : 0);
  const time = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return (
    <>
      <div className="timer-value">
        <TimerIcon size={29} />
        {time}
      </div>
      {size !== "S" && (
        <select
          aria-label="Задача для таймера"
          disabled={!!timer?.started_at}
          value={timer?.task_id || taskId}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="">Свободная работа</option>
          {active(data.tasks).map((t) => (
            <option value={t.id} key={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}
      <div className="timer-controls">
        <IconButton
          label={timer?.running_since ? "Пауза" : "Начать таймер"}
          onClick={() =>
            void action({
              action: "timer",
              command: timer?.running_since ? "pause" : "start",
              task_id: taskId,
              project_id: data.tasks.find((t) => t.id === taskId)?.project_id,
            })
          }
        >
          {timer?.running_since ? <Pause size={20} /> : <Play size={20} />}
        </IconButton>
        <IconButton
          label="Остановить и сохранить"
          onClick={() =>
            void action({ action: "timer", command: "stop" }, "Время сохранено")
          }
        >
          <Square size={17} />
        </IconButton>
      </div>
      {size === "L" && (
        <div>
          {active(data.time_entries)
            .filter(
              (entry) =>
                entry.started_at &&
                localDay(new Date(entry.started_at)) === localDay(),
            )
            .slice(0, 8)
            .map((entry) => (
              <div className="simple-row" key={entry.id}>
                <span>
                  {data.tasks.find((task) => task.id === entry.task_id)
                    ?.title ?? "Свободная работа"}
                </span>
                <small>{Math.round(entry.seconds / 60)} мин</small>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
