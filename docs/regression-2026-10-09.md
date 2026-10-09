# REGRESSION CHECK

Status: PASS WITH WARNINGS

Версия приложения: 1.3.3. Проверенный коммит: fb2e1fae4f5dc6b633e1bccb7ffa86a388bc8c02.
[Успешный workflow](https://github.com/Mikhail023/dashboard/actions/runs/37916921553).
[Опубликованный релиз](https://github.com/Mikhail023/dashboard/releases/tag/v1.3.3).

## Build

- TypeScript: PASS.
- Lint: PASS.
- Tests: 51/51, PASS на Windows x64, macOS arm64 и macOS x64.
- Development Build: локальный Vite/Electron dev-запуск и smoke-сценарий — PASS.
- Production Build: три платформенные сборки, запуск каждого упакованного приложения — PASS.
- Расширенный acceptance: PASS локально и на всех трёх GitHub runners.
- npm audit: 0 уязвимостей, включая инструменты разработки. Проверка добавлена в CI.

## Database

- Integrity: `integrity_check = ok`, нарушений foreign keys — 0 на изолированной базе.
- Migrations: существующие 001–003 сохранены, новых миграций не потребовалось.
- Persistence: сценарии перезапуска и восстановления прошли; тест переноса старой базы сохраняет её исходный fingerprint.
- Data Loss Risk: проверки выполнялись с временными данными или в памяти, пользовательская база не сбрасывалась и не заменялась.

## Modules Tested

Dashboard, Notes, Tasks, Projects, Calendar, Finance, Inbox, Habits, Smart Input,
Search, Command Palette, Settings, Daily Timeline, Focus, темы/акцент, grid S/M/L,
экспорт, backup/restore, renderer/main/preload и запуск со splash.

## Problems Found

- 18 npm audit warnings: устранены переходом Vitest на 4.1.11, override global-agent
  на 4.1.3 и удалением Tailwind-генератора. Существующий результат генератора сохранён
  в base.css с лицензией. Проверка нормализованного CSS до/после: побайтное совпадение.
- GitHub Actions v4 использовали неподдерживаемый Node 20. Обновлены checkout/setup-node/upload-artifact
  до v7, download-artifact до v8. Сохранён Node 22 для сборки самого приложения.
- Повторная публикация могла перезаписать уже выпущенные установщики. Новый publish-release.mjs
  разрешает повторное заполнение только черновика. На опубликованной v1.3.2 проверен отказ без изменения assets.
- Ошибка скачивания автоматически найденного обновления могла не показываться после
  согласия пользователя. Исправлено, добавлен отдельный регрессионный тест.
- Исправлена инструкция выпуска: перед npm version требуется коммит изменений.
- Скриншоты неудачного acceptance включены в диагностический artifact, включая скрытую папку .qa.

## Files Changed

- `.github/workflows/release.yml`
- `package.json`, `package-lock.json`
- `postcss.config.cjs`
- `src/main/updates.ts`
- `src/renderer/styles/app.css`
- `tests/updates.test.ts`
- `docs/releases.md`, `docs/release-notes.md`

Добавлены: `scripts/publish-release.mjs`, `src/renderer/styles/base.css`,
`docs/tailwind-license.txt`, этот отчёт. Удалён неиспользуемый после изменения
`tailwind.config.cjs`. Исходники модулей приложения и SQLite-архитектура сохранены.

## Remaining Issues

- Установщики не подписаны сертификатами Apple Developer / Windows; macOS показывает
  предложение скачать DMG, автоматическая установка Mac требует Developer ID.
- У упаковщика остаются предупреждения об устаревших внутренних зависимостях
  (rimraf, glob, inflight, prebuild-install, lodash.isequal); ESLint 9 помечен deprecated.
  Это не ошибки сборки; audit текущего lockfile показывает 0 уязвимостей.
- Старые failed/cancelled workflows сохранены как история. Оба последних проверенных
  workflow для main и v1.3.3 завершились успешно.
- Windows latest.yml и macOS latest-mac.yml проверены через публичные URL: версия 1.3.3,
  установщики доступны без GitHub token, Mac-манифест содержит обе архитектуры.

READY FOR NEXT DEVELOPMENT PHASE
