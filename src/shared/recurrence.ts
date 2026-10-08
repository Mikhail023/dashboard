import { isValidDate } from "./smart-input";
import { z } from "zod";
import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  startOfWeek,
} from "date-fns";
import type { Data, Row } from "./model";
export const recurrenceFields = {
  recurrence_rule: z
    .enum(["", "daily", "weekly", "monthly", "yearly", "weekdays", "selected"])
    .default(""),
  recurrence_interval: z.number().int().min(1).max(365).default(1),
  recurrence_days: z
    .string()
    .regex(/^(?:[0-6](?:,[0-6])*)?$/)
    .default(""),
  recurrence_until: z
    .string()
    .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && isValidDate(v)))
    .default(""),
};
export type RecurrenceRule = {
  recurrence_rule: string;
  recurrence_interval?: number;
  recurrence_days?: string;
  recurrence_until?: string;
};
export function expandRecurrence(
  start: string,
  rule: RecurrenceRule,
  from: Date,
  to: Date,
): Date[] {
  const origin = new Date(start.length === 10 ? start + "T00:00" : start);
  if (
    !start ||
    !Number.isFinite(+origin) ||
    !Number.isFinite(+from) ||
    !Number.isFinite(+to) ||
    to < from
  )
    return [];
  const end = rule.recurrence_until
    ? new Date(
        Math.min(+to, +new Date(rule.recurrence_until + "T23:59:59.999")),
      )
    : to;
  if (!Number.isFinite(+end)) return [];
  if (!rule.recurrence_rule)
    return origin >= from && origin <= end ? [origin] : [];
  const result: Date[] = [],
    interval = Math.max(1, rule.recurrence_interval ?? 1),
    kind = rule.recurrence_rule;
  if (kind === "monthly" || kind === "yearly") {
    const step = interval * (kind === "yearly" ? 12 : 1);
    let index = Math.max(
      0,
      Math.floor(differenceInCalendarMonths(from, origin) / step),
    );
    for (; ; index++) {
      const candidate = new Date(origin);
      candidate.setDate(1);
      candidate.setMonth(origin.getMonth() + index * step);
      candidate.setDate(
        Math.min(
          origin.getDate(),
          new Date(
            candidate.getFullYear(),
            candidate.getMonth() + 1,
            0,
          ).getDate(),
        ),
      );
      if (!Number.isFinite(+candidate) || candidate > end) break;
      if (candidate >= from) result.push(candidate);
    }
  } else if (kind === "selected" || kind === "weekdays") {
    const selected =
      kind === "weekdays"
        ? [1, 2, 3, 4, 5]
        : (rule.recurrence_days || String(origin.getDay()))
            .split(",")
            .map(Number);
    let d = addDays(
      origin,
      Math.max(0, differenceInCalendarDays(from, origin) - 1),
    );
    const anchor = startOfWeek(origin, { weekStartsOn: 1 });
    for (; d <= end; d = addDays(d, 1)) {
      const week = Math.floor(
        differenceInCalendarDays(startOfWeek(d, { weekStartsOn: 1 }), anchor) /
          7,
      );
      if (d >= from && selected.includes(d.getDay()) && week % interval === 0)
        result.push(new Date(d));
    }
  } else {
    const step = interval * (kind === "weekly" ? 7 : 1);
    let index = Math.max(
      0,
      Math.floor(differenceInCalendarDays(from, origin) / step),
    );
    for (; ; index++) {
      const d = addDays(origin, index * step);
      if (!Number.isFinite(+d) || d > end) break;
      if (d >= from) result.push(d);
    }
  }
  return result;
}
/** The first occurrence on or after from, without a fixed look-ahead window. */
export function nextRecurrence(
  start: string,
  rule: RecurrenceRule,
  from: Date,
): Date | undefined {
  const origin = new Date(start.length === 10 ? start + "T00:00" : start);
  if (!Number.isFinite(+origin) || !Number.isFinite(+from)) return undefined;
  const lower = new Date(Math.max(+origin, +from));
  const interval = Math.max(1, rule.recurrence_interval ?? 1);
  const days =
    rule.recurrence_rule === "yearly"
      ? 366
      : rule.recurrence_rule === "monthly"
        ? 31
        : ["weekly", "selected", "weekdays"].includes(rule.recurrence_rule)
          ? 7
          : 1;
  return expandRecurrence(
    start,
    rule,
    lower,
    addDays(lower, days * interval + 1),
  )[0];
}
export type TaskOccurrence = Row<"tasks"> & { occurrence_date?: string };
export function tasksInRange(
  data: Data,
  from: Date | undefined,
  to: Date,
): TaskOccurrence[] {
  const completions = new Map(
    data.task_completions
      .filter((c) => !c.deleted_at)
      .map((c) => [`${c.task_id}:${c.occurrence_date}`, c.completed_at]),
  );
  return data.tasks
    .filter((t) => !t.deleted_at)
    .flatMap((t) => {
      if (!t.recurrence_rule) return [t];
      return expandRecurrence(
        t.due_date,
        t,
        from ??
          new Date(
            t.due_date.length === 10 ? t.due_date + "T00:00" : t.due_date,
          ),
        to,
      ).map((d) => {
        const day = format(d, "yyyy-MM-dd"),
          completed_at = completions.get(`${t.id}:${day}`) ?? "";
        return {
          ...t,
          occurrence_date: day,
          due_date: format(
            d,
            t.due_date.includes("T") ? "yyyy-MM-dd'T'HH:mm" : "yyyy-MM-dd",
          ),
          status: completed_at
            ? ("done" as const)
            : t.status === "done"
              ? ("todo" as const)
              : t.status,
          completed_at,
        };
      });
    });
}
