import { expect, it } from "vitest";
import { emptyData, schemas } from "../src/shared/model";
import { dailyOverview } from "../src/shared/daily";
it("uses local timestamps for historical days, excludes deleted records and transfers", () => {
  const data = emptyData(),
    meta = {
      id: "t",
      created_at: "2026-10-05T23:00:00Z",
      updated_at: "2026-10-06T10:00:00Z",
      deleted_at: "",
      demo: false,
    };
  data.tasks.push({
    ...meta,
    ...schemas.tasks.parse({
      title: "Finished",
      due_date: "2026-10-06",
      status: "done",
      completed_at: "2026-10-06T10:00",
    }),
  });
  data.notes.push({
    ...meta,
    id: "n",
    ...schemas.notes.parse({ title: "Note" }),
    created_at: "2026-10-06T10:20",
  });
  data.events.push({
    ...meta,
    id: "e",
    ...schemas.events.parse({
      title: "Meeting",
      start_at: "2026-10-06T14:30",
      end_at: "2026-10-06T15:30",
    }),
  });
  expect(dailyOverview(data, "2026-10-06")).toMatchObject({
    completed: 1,
    total: 1,
    notes: 1,
    events: 1,
    expenses: 0,
  });
  expect(dailyOverview(data, "2026-10-04").items).toHaveLength(0);
  expect(data.events).toHaveLength(1);
});

it("keeps overdue repeats older than thirty days and excludes completed occurrences", async () => {
  const { focusPlan } = await import("../src/shared/daily");
  const data = emptyData();
  data.tasks.push({
    id: "series",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: "",
    demo: false,
    ...schemas.tasks.parse({
      title: "Old repeat",
      due_date: "2026-01-01",
      recurrence_rule: "monthly",
    }),
  });
  data.task_completions.push({
    id: "completion",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: "",
    demo: false,
    task_id: "series",
    occurrence_date: "2026-01-01",
    completed_at: "2026-01-01T12:00",
  });
  const plan = focusPlan(data, new Date("2026-10-06T12:00"));
  expect(plan.overdue).toBe(9);
  expect(plan.tasks[0].occurrence_date).toBe("2026-02-01");
  expect(data.tasks).toHaveLength(1);
});

it("counts a completed old repeat separately from today's pending repeat", () => {
  const data = emptyData();
  const meta = {
    id: "series",
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
    deleted_at: "",
    demo: false,
  };
  data.tasks.push({
    ...meta,
    ...schemas.tasks.parse({
      title: "Daily",
      due_date: "2026-10-01",
      recurrence_rule: "daily",
    }),
  });
  data.task_completions.push({
    ...meta,
    id: "c",
    task_id: "series",
    occurrence_date: "2026-10-01",
    completed_at: "2026-10-06T12:00",
  });
  expect(dailyOverview(data, "2026-10-06")).toMatchObject({
    completed: 1,
    total: 2,
  });
});
