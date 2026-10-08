import type { Data, Row } from "./model";
import { localDay } from "./smart-input";
export function budgetProgress(
  data: Data,
  budget: Row<"budgets">,
  month = localDay().slice(0, 7),
) {
  const ids = new Set(
    data.accounts
      .filter((a) => a.currency === budget.currency)
      .map((a) => a.id),
  );
  const spent =
    data.transactions
      .filter(
        (t) =>
          !t.deleted_at &&
          t.type === "expense" &&
          t.date.startsWith(month) &&
          ids.has(t.account_id) &&
          (!budget.category_id || t.category_id === budget.category_id),
      )
      .reduce((sum, t) => sum + Math.round(t.amount * 100), 0) / 100;
  return {
    spent,
    remaining: Math.round((budget.amount - spent) * 100) / 100,
    percentage: Math.round((spent / budget.amount) * 100),
  };
}
export function remainingBudget(
  data: Data,
  currency: string,
  month = localDay().slice(0, 7),
) {
  const budgets = data.budgets.filter(
      (b) => !b.deleted_at && b.currency === currency,
    ),
    overall = budgets.find((b) => !b.category_id);
  return budgets.length
    ? (overall ? [overall] : budgets).reduce(
        (sum, b) => sum + budgetProgress(data, b, month).remaining,
        0,
      )
    : null;
}
