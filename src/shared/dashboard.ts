export const widgetIds = [
  "habits",
  "analytics",
  "reminders",
  "projects",
  "progress",
  "timer",
  "finance",
  "notes",
  "today",
  "overdue",
  "expenses",
  "inbox",
  "daily",
  "budgets",
  "goals",
] as const;
export type Widget = {
  id: (typeof widgetIds)[number];
  title: string;
  visible: boolean;
  size?: "S" | "M" | "L";
};
export const widgetDefaults: Widget[] = [
  { id: "habits", title: "Привычки", visible: false, size: "M" },
  { id: "budgets", title: "Бюджет месяца", visible: false, size: "M" },
  { id: "goals", title: "Финансовые цели", visible: false, size: "M" },
  { id: "today", title: "Задачи на сегодня", visible: true, size: "M" },
  { id: "analytics", title: "Аналитика задач", visible: true, size: "M" },
  { id: "reminders", title: "Ближайшие события", visible: true, size: "M" },
  { id: "projects", title: "Активные проекты", visible: true, size: "M" },
  { id: "progress", title: "Прогресс задач", visible: true, size: "M" },
  { id: "timer", title: "Тайм-трекер", visible: true, size: "M" },
  { id: "finance", title: "Финансы", visible: true, size: "M" },
  { id: "notes", title: "Последние заметки", visible: true, size: "L" },
  { id: "overdue", title: "Просроченные задачи", visible: false, size: "M" },
  { id: "expenses", title: "Расходы за месяц", visible: false, size: "M" },
  { id: "inbox", title: "Входящие", visible: false, size: "M" },
  { id: "daily", title: "Статистика дня", visible: false, size: "M" },
];
export function loadWidgets(value?: string): Widget[] {
  try {
    const saved = value ? (JSON.parse(value) as Widget[]) : [];
    const known = saved.filter((w) =>
      widgetDefaults.some((d) => d.id === w.id),
    );
    return [
      ...known.map((w) => ({
        ...widgetDefaults.find((d) => d.id === w.id)!,
        ...w,
      })),
      ...widgetDefaults.filter((d) => !known.some((w) => w.id === d.id)),
    ];
  } catch {
    return widgetDefaults;
  }
}
