# Dashboard для macOS

Исходники приложения общие: `../src`. Эта папка содержит настройки macOS-сборки.

```sh
npm ci
npm run build:mac
```

Результат: `release/mac/`, DMG и ZIP для Apple Silicon и Intel. Установите Dashboard
перетаскиванием из DMG в Applications. База остаётся в `~/Library/Application Support/Dashboard`.

Новая версия автоматически проверяется после готовности интерфейса и каждые 6 часов.
Текущая сборка без Developer ID предлагает скачать DMG. Для автоматической установки
нужны подпись Developer ID, ZIP и флаг `dashboardMacAutoUpdate: true` в package metadata.
Не включайте этот флаг до настройки подписанных сборок.
