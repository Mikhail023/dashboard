import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useDeferredValue,
} from "react";
import { Search as SearchIcon, ArrowUpRight } from "lucide-react";
import { useApp, useData, active, action, type Page } from "../store";
import { Modal } from "./UI";
import {
  searchIndex,
  searchEntities,
  searchTypes,
  type SearchFilters,
} from "../../shared/search";
import { labels, type Table } from "../../shared/model";
export default function Search() {
  const data = useData(),
    navigate = useApp((s) => s.navigate);
  const [query, setQuery] = useState(""),
    [index, setIndex] = useState(0),
    [filters, setFilters] = useState<SearchFilters>({});
  const input = useRef<HTMLInputElement>(null),
    results = useRef<HTMLDivElement>(null);
  const close = useCallback(() => useApp.setState({ searchOpen: false }), []);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const corpus = useMemo(() => searchIndex(data), [data]);
  const deferredQuery = useDeferredValue(query);
  const found = useMemo(
    () => searchEntities(corpus, deferredQuery, filters).slice(0, 60),
    [corpus, deferredQuery, filters],
  );
  const commands: {
    id: string;
    label: string;
    keywords: string;
    run: () => void;
  }[] = [
    ...(
      [
        ["daily_goals", "Новая привычка", "New Habit Daily Goal"],
        ["notes", "Новая заметка", "New Note"],
        ["tasks", "Новая задача", "New Task"],
        ["events", "Новое событие", "New Event"],
        ["projects", "Новый проект", "New Project"],
      ] as [Table, string, string][]
    ).map(([table, label, keywords]) => ({
      id: `new-${table}`,
      label,
      keywords,
      run: () => useApp.getState().edit(table),
    })),
    ...(["expense", "income"] as const).map((type) => ({
      id: type,
      label: type === "expense" ? "Добавить расход" : "Добавить доход",
      keywords: type === "expense" ? "Add Expense" : "Add Income",
      run: () => useApp.getState().edit("transactions", undefined, { type }),
    })),
    ...(
      [
        ["habits", "Привычки", "Habits Daily Goals"],
        ["dashboard", "Дашборд", "Dashboard"],
        ["notes", "Заметки", "Notes"],
        ["tasks", "Задачи", "Tasks"],
        ["finance", "Финансы", "Finance"],
        ["calendar", "Календарь", "Calendar"],
        ["projects", "Проекты", "Projects"],
        ["inbox", "Входящие", "Inbox"],
      ] as [Page, string, string][]
    ).map(([page, label, english]) => ({
      id: `open-${page}`,
      label: `Открыть ${label}`,
      keywords: `Open ${english}`,
      run: () => navigate(page),
    })),
    {
      id: "customize",
      label: "Настроить дашборд",
      keywords: "Customize Dashboard",
      run: () => navigate("dashboard", "customize"),
    },
    {
      id: "scheme",
      label: "Изменить цветовую схему",
      keywords: "Change Color Scheme",
      run: () => navigate("settings"),
    },
    {
      id: "smart",
      label: "Быстрый ввод",
      keywords: "Smart Input",
      run: () => useApp.setState({ smartOpen: true }),
    },
    {
      id: "timeline",
      label: "Открыть историю дня",
      keywords: "Daily Timeline",
      run: () => navigate("timeline"),
    },
    {
      id: "focus",
      label: "Открыть фокус",
      keywords: "Daily Focus",
      run: () => navigate("focus"),
    },
    {
      id: "timer",
      label: "Начать таймер",
      keywords: "Start Timer",
      run: () => {
        void action({ action: "timer", command: "start" });
      },
    },
  ];
  const matchedCommands = Object.values(filters).some(Boolean)
    ? []
    : commands.filter((c) =>
        `${c.label} ${c.keywords}`.toLowerCase().includes(query.toLowerCase()),
      );
  const matches = [
    ...matchedCommands.map((c) => ({ ...c, kind: "Команда" })),
    ...found.map((r) => ({
      id: `${r.table}-${r.id}`,
      label: filters.date && r.recurrence ? `${r.title} · ${r.date}` : r.title,
      kind: searchTypes[r.table],
      run: () => {
        if (
          r.table === "events" ||
          r.table === "transactions" ||
          (r.table === "tasks" && !!r.recurrence && !!filters.date)
        )
          useApp.getState().edit(
            r.table,
            data[r.table].find((e) => e.id === r.id),
          );
        else if (r.table === "daily_goals") navigate("habits", r.id);
        else navigate(r.table, r.id);
      },
    })),
  ];
  const selected = Math.min(index, Math.max(0, matches.length - 1));
  const choose = (i: number) => {
    const item = matches[i];
    if (item) {
      close();
      item.run();
    }
  };
  useEffect(() => {
    results.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const filter = (key: keyof SearchFilters, value: string) => {
    setFilters({ ...filters, [key]: value });
    setIndex(0);
  };
  return (
    <Modal title="Поиск и команды" onClose={close} wide>
      <div className="search-field command-input">
        <SearchIcon size={20} />
        <input
          ref={input}
          role="combobox"
          aria-label="Поиск и команды"
          aria-controls="search-results"
          aria-expanded="true"
          aria-activedescendant={
            matches[selected] ? `result-${matches[selected].id}` : undefined
          }
          placeholder="Название, текст, сумма или команда…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (
              ["ArrowDown", "ArrowUp", "Home", "End", "Enter"].includes(e.key)
            )
              e.preventDefault();
            if (e.key === "ArrowDown")
              setIndex((selected + 1) % Math.max(1, matches.length));
            if (e.key === "ArrowUp")
              setIndex(
                (selected - 1 + matches.length) % Math.max(1, matches.length),
              );
            if (e.key === "Home") setIndex(0);
            if (e.key === "End") setIndex(Math.max(0, matches.length - 1));
            if (e.key === "Enter") choose(selected);
          }}
        />
        <kbd>esc</kbd>
      </div>
      <div className="filters search-filters">
        <select
          aria-label="Тип поиска"
          value={filters.type ?? ""}
          onChange={(e) => filter("type", e.target.value)}
        >
          <option value="">Все типы</option>
          {Object.entries(searchTypes).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Дата поиска"
          value={filters.date ?? ""}
          onChange={(e) => filter("date", e.target.value)}
        />
        <select
          aria-label="Проект поиска"
          value={filters.project ?? ""}
          onChange={(e) => filter("project", e.target.value)}
        >
          <option value="">Все проекты</option>
          {active(data.projects).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Тег поиска"
          placeholder="Тег"
          value={filters.tag ?? ""}
          onChange={(e) => filter("tag", e.target.value)}
        />
        <select
          aria-label="Статус поиска"
          value={filters.status ?? ""}
          onChange={(e) => filter("status", e.target.value)}
        >
          <option value="">Все статусы</option>
          {Array.from(
            new Set([
              ...corpus.map((r) => r.status),
              "todo",
              "in_progress",
              "pending",
              "done",
            ]),
          )
            .filter(Boolean)
            .map((s) => (
              <option key={s} value={s}>
                {labels[s] ?? s}
              </option>
            ))}
        </select>
      </div>
      <div
        ref={results}
        id="search-results"
        role="listbox"
        className="command-results"
      >
        {matches.map((r, i) => (
          <button
            id={`result-${r.id}`}
            role="option"
            aria-selected={i === selected}
            key={r.id}
            className={i === selected ? "selected" : ""}
            onClick={() => choose(i)}
          >
            <span>
              <strong>{r.label}</strong>
              <small>{r.kind}</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))}
        {!matches.length && <p className="muted">Ничего не найдено</p>}
      </div>
    </Modal>
  );
}
