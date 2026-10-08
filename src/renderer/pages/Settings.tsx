import { useState } from "react";
import {
  Database,
  Shield,
  Palette,
  UserRound,
  Download,
  Upload,
  HardDrive,
  Trash2,
  LockKeyhole,
} from "lucide-react";
import { useApp, action } from "../store";
import { Button, Card, Heading } from "../components/UI";
export default function Settings() {
  const state = useApp((s) => s.state)!;
  const [profile, setProfile] = useState(state.profile),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState("");
  const settings = state.settings;
  const setting = (key: string, value: string) =>
    void action({ action: "settings", data: { [key]: value } });
  return (
    <>
      <Heading
        title="Настройки"
        subtitle="Приложение, которое подстраивается под вас"
      />
      <div className="settings-grid">
        <Card title="Профиль" action={<UserRound size={20} />}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void action(
                { action: "profile", data: profile },
                "Профиль обновлён",
              );
            }}
          >
            <label>
              Имя
              <input
                value={profile.name}
                required
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
              />
            </label>
            <label>
              Аватар
              <select
                value={profile.avatar_path}
                onChange={(e) =>
                  setProfile({ ...profile, avatar_path: e.target.value })
                }
              >
                {["🌿", "🧑‍💻", "🌞", "🌸", "🦊", "🐱", "🚀"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <Button>Сохранить профиль</Button>
          </form>
        </Card>
        <Card title="Внешний вид и формат" action={<Palette size={20} />}>
          <div className="form-stack">
            <label>
              Акцентный цвет
              <select
                aria-label="Акцентный цвет"
                value={settings.accentColor ?? ""}
                onChange={(e) => setting("accentColor", e.target.value)}
              >
                <option value="">Исходная палитра</option>
                {[
                  ["#c45b16", "Orange · Оранжевый"],
                  ["#2463ce", "Blue · Синий"],
                  ["#824dcc", "Purple · Фиолетовый"],
                  ["#1f7a4d", "Green · Зелёный"],
                  ["#c33e4a", "Red · Красный"],
                  ["#59616d", "Graphite · Графит"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
                {settings.accentColor &&
                  ![
                    "#c45b16",
                    "#2463ce",
                    "#824dcc",
                    "#1f7a4d",
                    "#c33e4a",
                    "#59616d",
                  ].includes(settings.accentColor) && (
                    <option value={settings.accentColor}>Свой цвет</option>
                  )}
              </select>
            </label>
            <label>
              Свой акцент
              <input
                type="color"
                aria-label="Свой акцент"
                value={settings.accentColor || "#1f7a4d"}
                onChange={(e) => setting("accentColor", e.target.value)}
              />
            </label>
            <label>
              Тема
              <select
                aria-label="Тема"
                value={settings.theme ?? "system"}
                onChange={(e) => setting("theme", e.target.value)}
              >
                <option value="system">Как в системе</option>
                <option value="light">Светлая</option>
                <option value="dark">Тёмная</option>
              </select>
            </label>
            <label>
              Плотность
              <select
                value={settings.density ?? "comfortable"}
                onChange={(e) => setting("density", e.target.value)}
              >
                <option value="comfortable">Комфортная</option>
                <option value="compact">Компактная</option>
              </select>
            </label>
            <label>
              Валюта сводки
              <select
                value={settings.currency ?? "RUB"}
                onChange={(e) => setting("currency", e.target.value)}
              >
                <option value="RUB">Российский рубль · ₽</option>
                <option value="USD">Доллар · $</option>
                <option value="EUR">Евро · €</option>
              </select>
            </label>
            <label>
              Начало недели
              <select
                value={settings.weekStart ?? "1"}
                onChange={(e) => setting("weekStart", e.target.value)}
              >
                <option value="1">Понедельник</option>
                <option value="0">Воскресенье</option>
              </select>
            </label>
          </div>
        </Card>
        <Card title="Безопасность" action={<Shield size={20} />}>
          <div className="form-stack">
            <label>
              Автоблокировка
              <select
                value={settings.autoLock ?? "5"}
                onChange={(e) => setting("autoLock", e.target.value)}
              >
                {["1", "5", "15", "30", "0"].map((v) => (
                  <option key={v} value={v}>
                    {v === "0" ? "Никогда" : `Через ${v} мин.`}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                disabled={!state.touchID}
                checked={settings.touchID === "true"}
                onChange={(e) => setting("touchID", String(e.target.checked))}
              />
              Быстрая разблокировка Touch ID
            </label>
            {!state.touchID && (
              <small className="muted">
                Touch ID недоступен на этом устройстве.
              </small>
            )}
            <div className="info-box">
              <LockKeyhole size={18} />
              <span>
                Пароль защищает вход в приложение. Шифрование файла базы пока не
                включено; используйте FileVault для защиты диска.
              </span>
            </div>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await action(
                  { action: "password", current, password },
                  "Пароль изменён",
                );
                if (ok) {
                  setCurrent("");
                  setPassword("");
                }
              }}
            >
              <label>
                Текущий пароль
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </label>
              <label>
                Новый пароль
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Button secondary>Изменить пароль</Button>
            </form>
          </div>
        </Card>
        <Card title="Данные и резервные копии" action={<Database size={20} />}>
          <p className="muted">
            Ежедневная копия при запуске. Храним последние 14 копий.
          </p>
          <div className="backup-info">
            <HardDrive size={24} />
            <div>
              <strong>Последняя копия</strong>
              <p>
                {settings.lastBackup
                  ? new Date(settings.lastBackup).toLocaleString("ru-RU")
                  : "Ещё не создана"}
              </p>
            </div>
          </div>
          <div className="settings-actions">
            <Button
              onClick={() =>
                void action({ action: "backup" }, "Резервная копия создана")
              }
            >
              <HardDrive size={17} />
              Создать резервную копию
            </Button>
            <Button
              secondary
              onClick={() => void action({ action: "restoreBackup" })}
            >
              Восстановить из копии
            </Button>
            <Button
              secondary
              onClick={() =>
                void action({ action: "exportJSON" }, "Данные экспортированы")
              }
            >
              <Download size={17} />
              Экспорт всех данных в JSON
            </Button>
            <Button
              secondary
              onClick={() =>
                void action({ action: "importJSON" }, "Данные импортированы")
              }
            >
              <Upload size={17} />
              Импорт из JSON
            </Button>
          </div>
          <label>
            Путь к базе
            <input readOnly value={state.dbPath} />
          </label>
          <div className="settings-actions">
            <Button
              secondary
              onClick={() =>
                void action({ action: "demo" }, "Демо-данные добавлены")
              }
            >
              Заполнить демо-данными
            </Button>
            <Button
              secondary
              onClick={() =>
                void action({ action: "clearDemo" }, "Демо-данные удалены")
              }
            >
              Удалить только демо-данные
            </Button>
            <Button
              secondary
              className="danger-text"
              onClick={() => {
                const confirmation = window.prompt(
                  "Это действие удалит профиль и все данные. Введите: УДАЛИТЬ ВСЕ ДАННЫЕ",
                );
                if (confirmation)
                  void action({ action: "reset", confirmation });
              }}
            >
              <Trash2 size={17} />
              Очистить все данные
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
