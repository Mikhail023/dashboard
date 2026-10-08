import type { Repository } from "./database";
export function seed(repo: Repository) {
  if (repo.data().projects.some((p) => p.demo)) return;
  repo.db.transaction(() => {
    const save = repo.save.bind(repo);
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    const projects = [
      "Редизайн дашборда",
      "Разработка API",
      "Онбординг",
      "Личный сайт",
      "Исследование продукта",
      "Мобильное приложение",
      "Документация",
      "Планирование квартала",
    ].map((name, i) =>
      save(
        "projects",
        {
          name,
          description:
            "От идеи к результату. Задачи, материалы и решения по проекту.",
          status: [
            "running",
            "running",
            "ended",
            "running",
            "pending",
            "planned",
            "ended",
            "pending",
          ][i],
          color: ["#1F7A4D", "#6B5DD3", "#E6A13D", "#3795BC"][i % 4],
          due_date: day(i * 3 + 2),
        },
        true,
      ),
    );
    const titles = [
      "Собрать референсы",
      "Подготовить прототип",
      "Обсудить архитектуру",
      "Проверить гипотезу",
      "Написать документацию",
      "Согласовать макеты",
      "Проверить доступность",
      "Выпустить обновление",
    ];
    for (let i = 0; i < 24; i++) {
      const status = ["done", "in_progress", "todo", "pending", "done", "done"][
        i % 6
      ];
      const task = save(
        "tasks",
        {
          title: titles[i % 8],
          project_id: projects[i % 8].id,
          status,
          priority: ["high", "medium", "low"][i % 3],
          due_date: day((i % 10) - 2),
          completed_at:
            status === "done" ? day(-(i % 6)) + "T12:00:00.000Z" : "",
          assignee_label: "Я",
        },
        true,
      );
      if (i < 4)
        save(
          "subtasks",
          { task_id: task.id, title: "Проверить результат", done: i === 0 },
          true,
        );
    }
    const folder = save(
      "note_folders",
      { name: "Рабочие заметки", color: "#6B5DD3" },
      true,
    );
    [
      "Идеи для нового проекта",
      "План на неделю",
      "Технические заметки",
      "Книги к прочтению",
      "Итоги встречи",
      "Место для вдохновения",
    ].forEach((title, i) => {
      const content =
        "Собрать мысли, определить следующий шаг и оставить место для новых идей.";
      save(
        "notes",
        {
          title,
          folder_id: folder.id,
          project_id: projects[i % 8].id,
          content_text: content,
          content_json: JSON.stringify({
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: content }] },
            ],
          }),
          tags: i % 2 ? "личное" : "работа",
          pinned: i === 0,
          color: ["#1F7A4D", "#6B5DD3", "#E6A13D"][i % 3],
        },
        true,
      );
    });
    [
      "Встреча по проекту",
      "Планирование недели",
      "Обсуждение прототипа",
      "Демо для команды",
      "Подведение итогов",
    ].forEach((title, i) =>
      save(
        "events",
        {
          title,
          start_at: day(i) + "T14:00",
          end_at: day(i) + "T15:00",
          project_id: projects[i].id,
          color: projects[i].color,
          remind_before_min: 15,
        },
        true,
      ),
    );
    const accounts = [
      save(
        "accounts",
        { name: "Основная карта", type: "card", balance_initial: 86500 },
        true,
      ),
      save(
        "accounts",
        { name: "Накопления", type: "bank", balance_initial: 120000 },
        true,
      ),
      save(
        "accounts",
        { name: "Наличные", type: "cash", balance_initial: 7500 },
        true,
      ),
    ];
    const cats = ["Продукты", "Транспорт", "Сервисы", "Проекты"].map(
      (name, i) =>
        save(
          "categories",
          {
            name,
            type: i === 3 ? "income" : "expense",
            color: ["#1F7A4D", "#6B5DD3", "#E6A13D", "#3795BC"][i],
          },
          true,
        ),
    );
    for (let i = 0; i < 26; i++)
      save(
        "transactions",
        {
          account_id: accounts[i % 3].id,
          type: i % 5 === 0 ? "income" : "expense",
          amount: i % 5 === 0 ? 25000 + i * 1000 : 450 + i * 135,
          category_id: cats[i % 5 === 0 ? 3 : i % 3].id,
          date: day(-i),
          note: i % 5 === 0 ? "Оплата работы" : "Повседневные расходы",
          project_id: i % 5 === 0 ? projects[i % 8].id : "",
        },
        true,
      );
    for (let i = 0; i < 5; i++) {
      const invoice = save(
        "invoices",
        {
          number: `INV-${String(i + 1).padStart(3, "0")}`,
          client_name: [
            "Алексей Смирнов",
            "Анна Волкова",
            "Студия «Форма»",
            "Михаил Петров",
            "Команда «Точка»",
          ][i],
          company: "Дизайн и разработка",
          project_id: projects[i].id,
          status: ["unsent", "viewed", "overdue", "draft", "unsent"][i],
          issue_date: day(-10),
          due_date: day(i * 5 - 3),
        },
        true,
      );
      save(
        "invoice_items",
        {
          invoice_id: invoice.id,
          title: "Работы по проекту",
          amount: 35000 + i * 15000,
        },
        true,
      );
    }
  })();
}
