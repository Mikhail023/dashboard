import { expect, it } from "vitest";
import { emptyData, schemas, type Row } from "../src/shared/model";
import { searchIndex, searchEntities } from "../src/shared/search";
it("filters indexed entities and excludes trash", () => {
  const data = emptyData();
  const meta = {
    id: "x",
    created_at: "2026-10-06T12:00:00",
    updated_at: "2026-10-06T12:00:00",
    deleted_at: "",
    demo: false,
  };
  data.notes.push({
    ...meta,
    ...schemas.notes.parse({
      title: "Корм коту",
      tags: "дом",
      content_text: "заказать",
    }),
  } as Row<"notes">);
  const index = searchIndex(data);
  expect(
    searchEntities(index, "корм заказать", {
      type: "notes",
      date: "2026-10-06",
      tag: "дом",
      status: "active",
    }),
  ).toHaveLength(1);
  expect(searchEntities(index, "корм", { type: "tasks" })).toHaveLength(0);
  data.notes[0].deleted_at = "2026-10-07";
  expect(searchIndex(data)).toHaveLength(0);
});

it("searches a recurring date with its own completion status and end boundary", () => {
  const data = emptyData();
  const meta = {
    id: "series",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: "",
    demo: false,
  };
  data.tasks.push({
    ...meta,
    ...schemas.tasks.parse({
      title: "Weekly review",
      due_date: "2026-10-01",
      recurrence_rule: "weekly",
      recurrence_until: "2026-10-20",
    }),
  });
  data.events.push({
    ...meta,
    id: "event",
    ...schemas.events.parse({
      title: "Weekly meeting",
      start_at: "2026-10-01T14:00",
      end_at: "2026-10-01T15:00",
      recurrence_rule: "weekly",
    }),
  });
  data.task_completions.push({
    ...meta,
    id: "c",
    task_id: "series",
    occurrence_date: "2026-10-08",
    completed_at: "2026-10-08T15:00",
  });
  const index = searchIndex(data);
  expect(searchEntities(index, "weekly", { date: "2026-10-08" })).toHaveLength(
    2,
  );
  expect(
    searchEntities(index, "review", { date: "2026-10-08", status: "done" }),
  ).toHaveLength(1);
  expect(
    searchEntities(index, "review", { date: "2026-10-15", status: "done" }),
  ).toHaveLength(0);
  expect(searchEntities(index, "review", { date: "2026-10-22" })).toHaveLength(
    0,
  );
  expect(searchEntities(index, "weekly", { date: "2026-10-09" })).toHaveLength(
    0,
  );
});
