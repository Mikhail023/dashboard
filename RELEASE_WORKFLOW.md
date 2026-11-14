# macOS release and Desktop shortcut

Run `npm run build:arm64` on Apple Silicon or `npm run build:mac` when both Mac architectures are needed. After a successful build, the scripts replace `~/Desktop/Dashboard.app` with a link to the newly packaged app and remove stale release artifacts. The current Windows installer is retained until a newer Windows build exists.

The workflow never removes `~/Library/Application Support/Dashboard`, the SQLite database, user settings, or the `Backups` directory. To refresh the Desktop link manually after packaging, run `node scripts/refresh-desktop.mjs`.
