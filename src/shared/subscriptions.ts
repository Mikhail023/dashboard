import type { Row } from "./model";

function addPeriod(
  day: string,
  count: number,
  interval: Row<"subscriptions">["interval"],
) {
  const [year, month, date] = day.split("-").map(Number);
  if (interval === "daily")
    return new Date(Date.UTC(year, month - 1, date + count));
  if (interval === "weekly")
    return new Date(Date.UTC(year, month - 1, date + count * 7));
  const monthOffset = interval === "yearly" ? count * 12 : count;
  const first = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(date, lastDay));
  return first;
}

export function nextSubscriptionPayment(
  subscription: Row<"subscriptions">,
  today: string,
) {
  let count = 1;
  let next = addPeriod(
    subscription.next_payment_at,
    count,
    subscription.interval,
  );
  while (next.toISOString().slice(0, 10) <= today)
    next = addPeriod(
      subscription.next_payment_at,
      ++count,
      subscription.interval,
    );
  return next.toISOString().slice(0, 10);
}
