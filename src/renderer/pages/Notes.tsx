import { useState, useEffect, useRef } from "react";
import { commandPressed } from "../../shared/platform";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Plus,
  Search,
  Pin,
  Archive,
  Trash2,
  Folder,
  Download,
  Bold,
  Italic,
  List,
  ListChecks,
  Heading2,
  Code,
  Quote,
  Link,
} from "lucide-react";
import { useApp, useData, active, action } from "../store";
import { Button, Empty, Heading, IconButton } from "../components/UI";
import type { Row } from "../../shared/model";
function NoteEditor({ note }: { note: Row<"notes"> }) {
  const [title, setTitle] = useState(note.title),
    [saved, setSaved] = useState("Сохранено");
  const pending = useRef<ReturnType<typeof setTimeout>>();
  const draft = useRef<Record<string, unknown>>({});
  const mounted = useRef(true);
  const flush = async () => {
    clearTimeout(pending.current);
    pending.current = undefined;
    const patch = { ...draft.current };
    if (!Object.keys(patch).length) return true;
    try {
      await useApp.getState().run({
        action: "save",
        table: "notes",
        data: { id: note.id, ...patch },
      });
      for (const key of Object.keys(patch))
        if (draft.current[key] === patch[key]) delete draft.current[key];
      if (mounted.current && !Object.keys(draft.current).length)
        setSaved("Сохранено");
      return true;
    } catch {
      if (mounted.current) setSaved("Не сохранено");
      return false;
    }
  };
  const queue = (patch: Record<string, unknown>) => {
    draft.current = { ...draft.current, ...patch };
    setSaved("Сохраняем…");
    clearTimeout(pending.current);
    pending.current = setTimeout(() => void flush(), 500);
  };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, protocols: ["https", "http", "mailto"] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: JSON.parse(note.content_json),
    editable: !note.deleted_at,
    onUpdate: ({ editor }) =>
      queue({
        content_json: JSON.stringify(editor.getJSON()),
        content_text: editor.getText(),
      }),
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(pending.current);
      if (Object.keys(draft.current).length)
        void useApp
          .getState()
          .run(
            {
              action: "save",
              table: "notes",
              data: { id: note.id, ...draft.current },
            },
            false,
          )
          .catch(() => {});
    };
  }, [note.id]);
  if (!editor) return null;
  const exportNote = async (format: "markdown" | "pdf") => {
    if (!(await flush())) return;
    void action(
      { action: "export", table: "notes", id: note.id, format },
      "Файл сохранён",
    );
  };
  return (
    <div className="note-editor">
      <div className="note-meta">
        <small>{saved}</small>
        <div className="row">
          {!note.deleted_at && (
            <button
              className="text-button"
              onClick={async () => {
                if (!(await flush())) return;
                const current =
                  useApp
                    .getState()
                    .state?.data.notes.find((n) => n.id === note.id) ?? note;
                useApp.getState().edit("tasks", undefined, {
                  title: current.title,
                  description: current.content_text,
                  project_id: current.project_id,
                  note_id: note.id,
                });
              }}
            >
              Создать задачу
            </button>
          )}
          <IconButton
            label="Закрепить"
            aria-pressed={note.pinned}
            onClick={() => {
              queue({ pinned: !note.pinned });
              void flush();
            }}
          >
            <Pin size={16} />
          </IconButton>
          <IconButton
            label="Архивировать"
            onClick={() => {
              queue({ archived: !note.archived });
              void flush();
            }}
          >
            <Archive size={16} />
          </IconButton>
          <IconButton
            label="Экспорт Markdown"
            onClick={() => void exportNote("markdown")}
          >
            <Download size={16} />
          </IconButton>
          <button
            className="text-button"
            onClick={() => void exportNote("pdf")}
          >
            PDF
          </button>
          <IconButton
            label={note.deleted_at ? "Восстановить" : "Удалить"}
            onClick={() =>
              void flush().then(
                (ok) =>
                  ok &&
                  action({
                    action: note.deleted_at ? "restoreRow" : "remove",
                    table: "notes",
                    id: note.id,
                  }),
              )
            }
          >
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>
      <input
        aria-label="Заголовок заметки"
        className="note-title-input"
        value={title}
        readOnly={!!note.deleted_at}
        onChange={(e) => {
          setTitle(e.target.value);
          queue({ title: e.target.value || "Без названия" });
        }}
      />
      <div className="editor-toolbar">
        {[
          {
            label: "Жирный",
            icon: Bold,
            run: () => editor.chain().focus().toggleBold().run(),
          },
          {
            label: "Курсив",
            icon: Italic,
            run: () => editor.chain().focus().toggleItalic().run(),
          },
          {
            label: "Заголовок",
            icon: Heading2,
            run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          },
          {
            label: "Список",
            icon: List,
            run: () => editor.chain().focus().toggleBulletList().run(),
          },
          {
            label: "Чек-лист",
            icon: ListChecks,
            run: () => editor.chain().focus().toggleTaskList().run(),
          },
          {
            label: "Код",
            icon: Code,
            run: () => editor.chain().focus().toggleCodeBlock().run(),
          },
          {
            label: "Цитата",
            icon: Quote,
            run: () => editor.chain().focus().toggleBlockquote().run(),
          },
          {
            label: "Ссылка",
            icon: Link,
            run: () => {
              const href = window.prompt("Адрес ссылки (https://…)");
              if (href && /^https?:\/\//.test(href))
                editor.chain().focus().setLink({ href }).run();
            },
          },
        ].map(({ label, icon: Icon, run }) => (
          <IconButton label={label} key={label} onClick={run}>
            <Icon size={17} />
          </IconButton>
        ))}
      </div>
      <EditorContent editor={editor} />
      <div className="note-footer">
        <span>
          {note.tags
            .split(",")
            .filter(Boolean)
            .map((t) => "#" + t.trim())
            .join("  ")}
        </span>
        <button
          className="text-button"
          onClick={() => useApp.getState().edit("notes", note)}
        >
          Папка, теги и цвет
        </button>
      </div>
    </div>
  );
}
export default function Notes() {
  const data = useData(),
    selected = useApp((s) => s.selected),
    edit = useApp((s) => s.edit);
  const [folder, setFolder] = useState(
      data.notes.find((n) => n.id === selected)?.archived ? "archive" : "all",
    ),
    [query, setQuery] = useState(""),
    [tag, setTag] = useState(""),
    [sort, setSort] = useState("updated_at"),
    [id, setId] = useState(selected);
  const input = useRef<HTMLInputElement>(null);
  const notes = data.notes
    .filter(
      (n) =>
        (folder === "trash"
          ? !!n.deleted_at
          : !n.deleted_at &&
            (folder === "archive" ? n.archived : !n.archived)) &&
        (folder === "all" ||
          folder === "archive" ||
          folder === "trash" ||
          n.folder_id === folder) &&
        (!tag ||
          n.tags
            .split(",")
            .map((t) => t.trim())
            .includes(tag)) &&
        (n.title + " " + n.content_text)
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (sort === "title"
          ? a.title.localeCompare(b.title)
          : String(b[sort as "created_at"]).localeCompare(
              String(a[sort as "created_at"]),
            )),
    );
  const note = notes.find((n) => n.id === id) ?? notes[0];
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (commandPressed(e) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        edit("notes");
      }
      if (commandPressed(e) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        input.current?.focus();
      }
      if (commandPressed(e) && e.shiftKey && e.key.toLowerCase() === "p" && note) {
        e.preventDefault();
        void action({
          action: "save",
          table: "notes",
          data: { ...note, pinned: !note.pinned },
        });
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [edit, note]);
  return (
    <>
      <Heading title="Заметки" subtitle="Идеи, которым есть место">
        <Button onClick={() => edit("notes")}>
          <Plus size={17} />
          Новая заметка
        </Button>
      </Heading>
      <div className="notes-layout">
        <aside className="note-folders">
          <button
            className={folder === "all" ? "selected" : ""}
            onClick={() => setFolder("all")}
          >
            <Folder size={17} />
            Все заметки <small>{active(data.notes).length}</small>
          </button>
          <div className="section-label">
            ПАПКИ{" "}
            <IconButton
              label="Новая папка"
              onClick={() => edit("note_folders")}
            >
              <Plus size={15} />
            </IconButton>
          </div>
          {active(data.note_folders).map((f) => (
            <div className="folder-line" key={f.id}>
              <button
                className={folder === f.id ? "selected" : ""}
                onClick={() => setFolder(f.id)}
              >
                <i className="dot" style={{ background: f.color }} />
                {f.name}
              </button>
              <button
                aria-label="Изменить папку"
                className="text-button"
                onClick={() => edit("note_folders", f)}
              >
                ···
              </button>
            </div>
          ))}
          <div className="section-label">ТЕГИ</div>
          <select
            aria-label="Фильтр по тегам"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">Все теги</option>
            {[
              ...new Set(
                active(data.notes).flatMap((n) =>
                  n.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                ),
              ),
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button onClick={() => setFolder("archive")}>
            <Archive size={17} />
            Архив
          </button>
          <button onClick={() => setFolder("trash")}>
            <Trash2 size={17} />
            Корзина · 30 дней
          </button>
        </aside>
        <div className="note-list">
          <div className="search-field">
            <Search size={16} />
            <input
              ref={input}
              placeholder="Поиск заметок"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Сортировка"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="updated_at">По изменению</option>
            <option value="created_at">По созданию</option>
            <option value="title">По названию</option>
          </select>
          {notes.map((n) => (
            <button
              key={n.id}
              className={`note-list-item ${note?.id === n.id ? "selected" : ""}`}
              onClick={() => setId(n.id)}
            >
              <span className="row">
                <i className="dot" style={{ background: n.color }} />
                <strong>{n.title}</strong>
                {n.pinned && <Pin size={12} />}
              </span>
              <p>{n.content_text || "Пустая заметка"}</p>
              <small>
                {new Date(n.updated_at).toLocaleDateString("ru-RU")}
              </small>
            </button>
          ))}
        </div>
        {note ? (
          <NoteEditor key={note.id} note={note} />
        ) : (
          <Empty
            text="Пространство для ваших мыслей"
            onCreate={() => edit("notes")}
          />
        )}
      </div>
    </>
  );
}
