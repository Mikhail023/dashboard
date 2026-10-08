import { useMemo, useState } from "react";
import { commandKey } from "../../shared/platform";
import { useApp, useData } from "../store";
import { Button, Modal } from "./UI";
import {
  parseSmartInput,
  smartLabels,
  type SmartKind,
} from "../../shared/smart-input";
import { formatMoney } from "../../shared/calculations";
export default function SmartInput() {
  const data = useData();
  const [text, setText] = useState("");
  const [goalId, setGoalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<SmartKind | undefined>();
  const result = useMemo(
    () => parseSmartInput(text, data, new Date(), kind),
    [text, data, kind],
  );
  const habit =
    result.habitMatch.candidates.find((g) => g.id === goalId) ??
    (result.habitMatch.candidates.length === 1
      ? result.habitMatch.candidates[0]
      : undefined);
  const close = () => useApp.setState({ smartOpen: false });
  return (
    <Modal title="Быстрый ввод" onClose={close}>
      <div className="form-stack">
        <label>
          Что хотите добавить?
          <textarea
            autoFocus
            rows={3}
            maxLength={20000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Купить корм коту завтра вечером"
          />
        </label>
        <label>
          Распознано как
          <select
            value={kind ?? result.kind}
            onChange={(e) => setKind(e.target.value as SmartKind)}
          >
            {Object.entries(smartLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {result.kind === "habit" && (
          <label>
            Привычка для записи
            <select
              value={habit?.id ?? ""}
              onChange={(e) => setGoalId(e.target.value)}
            >
              <option value="">Выберите привычку…</option>
              {result.habitMatch.candidates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {text.trim() && (
          <div className="info-box" role="status">
            <div>
              <strong>{smartLabels[result.kind]}</strong>
              <p>
                {result.kind === "habit"
                  ? `${habit?.name ?? "Выберите привычку"} · ${result.date.day} · ${habit?.kind === "boolean" ? "Выполнено" : `Добавить ${result.habitMatch.value ?? 0} ${habit?.unit ?? ""}`}`
                  : String(result.fields.title ?? result.fields.note)}
              </p>
              {result.table === "transactions" ? (
                <p>
                  {formatMoney(result.amount, result.currency)} ·{" "}
                  {result.date.day} ·{" "}
                  {result.category?.name ??
                    (result.categoryName
                      ? `${result.categoryName} — новая категория`
                      : "Без категории")}
                </p>
              ) : (
                (result.date.found || result.kind === "event") && (
                  <p>
                    {result.date.day} {result.date.time}
                  </p>
                )
              )}
              {result.warning && <p className="error">{result.warning}</p>}
            </div>
          </div>
        )}
        <Button
          disabled={
            busy ||
            !text.trim() ||
            (result.kind === "habit" &&
              (!habit ||
                result.habitMatch.value === undefined ||
                !!result.date.warning)) ||
            (result.table === "transactions" && !result.account)
          }
          onClick={async () => {
            if (result.kind === "habit" && habit) {
              setBusy(true);
              try {
                await useApp.getState().run({
                  action: "recordGoal",
                  goal_id: habit.id,
                  day: result.date.day,
                  value: result.habitMatch.value ?? 0,
                  mode: habit.kind === "boolean" ? "set" : "add",
                });
                close();
                useApp.getState().notify("Прогресс привычки сохранён");
              } catch {
                /* toast */
              } finally {
                setBusy(false);
              }
              return;
            }
            close();
            useApp.getState().edit(result.table, undefined, result.fields);
          }}
        >
          {result.kind === "habit"
            ? "Сохранить прогресс"
            : "Проверить поля и сохранить"}
        </Button>
        <small className="muted">
          Распознавание работает на Mac. Перед сохранением все поля можно
          изменить. {commandKey()}⇧Space
        </small>
      </div>
    </Modal>
  );
}
