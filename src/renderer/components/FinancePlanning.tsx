import { useApp, useData, active, action } from "../store";
import { formatMoney } from "../../shared/calculations";
import { budgetProgress } from "../../shared/finance-planning";
import { Button, Empty } from "./UI";
export default function FinancePlanning({
  kind,
  compact = false,
  limit,
}: {
  kind: "budgets" | "financial_goals";
  compact?: boolean;
  limit?: number;
}) {
  const data = useData(),
    edit = useApp((s) => s.edit),
    currency = useApp((s) => s.state?.settings.currency) ?? "RUB";
  const budgets = active(data.budgets).filter(
      (b) => !compact || b.currency === currency,
    ),
    goals = active(data.financial_goals).filter(
      (g) => !compact || (g.currency === currency && g.status !== "completed"),
    );
  const items = kind === "budgets" ? budgets : goals;
  return (
    <div className="form-stack">
      {!compact && (
        <Button onClick={() => edit(kind)}>
          Добавить {kind === "budgets" ? "бюджет" : "цель"}
        </Button>
      )}
      {kind === "budgets"
        ? budgets.slice(0, limit).map((b) => {
            const p = budgetProgress(data, b);
            return (
              <div key={b.id} className="category-bar">
                <button
                  className="simple-row"
                  onClick={() => edit("budgets", b)}
                >
                  <strong>{b.name}</strong>
                  <span>{p.percentage}%</span>
                </button>
                <p>
                  {formatMoney(p.spent, b.currency)} /{" "}
                  {formatMoney(b.amount, b.currency)} в месяц
                </p>
                <div className="progress">
                  <i
                    style={{
                      width: `${Math.min(100, p.percentage)}%`,
                      background: p.remaining < 0 ? "var(--danger)" : undefined,
                    }}
                  />
                </div>
                <small className={p.remaining < 0 ? "error" : "muted"}>
                  {p.remaining < 0 ? "Превышение" : "Осталось"}:{" "}
                  {formatMoney(Math.abs(p.remaining), b.currency)}
                </small>
              </div>
            );
          })
        : goals.slice(0, limit).map((g) => (
            <div key={g.id} className="category-bar">
              <button
                className="simple-row"
                onClick={() => edit("financial_goals", g)}
              >
                <strong>{g.name}</strong>
                <span>
                  {Math.round((g.current_amount / g.target_amount) * 100)}%
                </span>
              </button>
              <p>
                {formatMoney(g.current_amount, g.currency)} /{" "}
                {formatMoney(g.target_amount, g.currency)}
              </p>
              <div className="progress">
                <i
                  style={{
                    width: `${Math.min(100, (g.current_amount / g.target_amount) * 100)}%`,
                  }}
                />
              </div>
              {g.status === "completed" ? (
                <small>Цель достигнута</small>
              ) : (
                !compact && (
                  <Button
                    secondary
                    onClick={() =>
                      void action(
                        {
                          action: "save",
                          table: "financial_goals",
                          data: { id: g.id, current_amount: g.target_amount },
                        },
                        "Цель завершена",
                      )
                    }
                  >
                    Завершить цель
                  </Button>
                )
              )}
            </div>
          ))}
      {limit !== undefined && items.length > limit && (
        <button
          className="text-button"
          onClick={() => useApp.getState().navigate("finance")}
        >
          Все записи ({items.length}) →
        </button>
      )}
      {!items.length && (
        <Empty
          text={
            kind === "budgets"
              ? "Бюджеты ещё не заданы"
              : "Добавьте финансовую цель"
          }
          onCreate={() => edit(kind)}
        />
      )}
    </div>
  );
}
