import { z } from "zod";
import { widgetIds } from "./dashboard";
export const settingsSchema = z
  .object({
    dashboardGoal: z.union([z.uuid(), z.literal("")]).optional(),
    dashboard: z
      .string()
      .max(5000)
      .refine((v) => {
        try {
          const w = z
            .array(
              z.object({
                id: z.enum(widgetIds),
                title: z.string().max(80),
                visible: z.boolean(),
                size: z.enum(["S", "M", "L"]).optional(),
              }),
            )
            .min(1)
            .max(widgetIds.length)
            .parse(JSON.parse(v));
          return new Set(w.map((x) => x.id)).size === w.length;
        } catch {
          return false;
        }
      })
      .optional(),
    dashboardTitle: z.string().max(80).optional(),
    dashboardSubtitle: z.string().max(180).optional(),
    kpis: z
      .string()
      .max(2500)
      .refine((v) => {
        try {
          const a = z
            .array(
              z.object({
                id: z.enum(["all", "ended", "running", "pending"]),
                title: z.string().max(80),
                visible: z.boolean(),
              }),
            )
            .length(4)
            .parse(JSON.parse(v));
          return new Set(a.map((x) => x.id)).size === 4;
        } catch {
          return false;
        }
      })
      .optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    accentColor: z
      .union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)])
      .optional(),
    lastStartedDay: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    currency: z.enum(["RUB", "USD", "EUR"]).optional(),
    autoLock: z.enum(["0", "1", "5", "15", "30"]).optional(),
    weekStart: z.enum(["0", "1"]).optional(),
    density: z.enum(["comfortable", "compact"]).optional(),
    touchID: z.enum(["true", "false"]).optional(),
  })
  .strict();
