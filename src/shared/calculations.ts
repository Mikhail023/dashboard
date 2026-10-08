import { format } from "date-fns";
import type { Data, Row } from "./model";
import { expandRecurrence } from "./recurrence";
export const progress = (tasks: Row<"tasks">[]) =>
  tasks.length
    ? Math.round(
        (tasks.filter((t) => t.status === "done").length / tasks.length) * 100,
      )
    : 0;
export const invoiceTotal = (data: Data, id: string) =>
  data.invoice_items
    .filter((i) => i.invoice_id === id && !i.deleted_at)
    .reduce((sum, i) => sum + Math.round(i.amount * 100), 0) / 100;
export function balance(data: Data, account: Row<"accounts">) {
  return (
    (Math.round(account.balance_initial * 100) +
      data.transactions
        .filter((t) => !t.deleted_at)
        .reduce(
          (sum, t) =>
            sum +
            (t.account_id === account.id
              ? (t.type === "income" ? 1 : -1) * Math.round(t.amount * 100)
              : 0) +
            (t.type === "transfer" && t.to_account_id === account.id
              ? Math.round(t.amount * 100)
              : 0),
          0,
        )) /
    100
  );
}
export function summary(
  data: Data,
  currency = "RUB",
  month = format(new Date(), "yyyy-MM"),
) {
  const accounts = data.accounts.filter(
    (a) => !a.deleted_at && a.currency === currency,
  );
  const ids = new Set(accounts.map((a) => a.id));
  const tx = data.transactions.filter(
    (t) => !t.deleted_at && ids.has(t.account_id) && t.date.startsWith(month),
  );
  const sum = (type: string) =>
    tx
      .filter((t) => t.type === type)
      .reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;
  return {
    income: sum("income"),
    expense: sum("expense"),
    balance: accounts.reduce((s, a) => s + balance(data, a), 0),
    unpaid: data.invoices
      .filter(
        (i) =>
          !i.deleted_at &&
          i.currency === currency &&
          i.status !== "paid" &&
          i.status !== "draft",
      )
      .reduce((s, i) => s + invoiceTotal(data, i.id), 0),
  };
}
export const formatMoney = (n: number, currency = "RUB") =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
export function occurrences(event: Row<"events">, from: Date, to: Date) {
  return expandRecurrence(event.start_at, event, from, to);
}
