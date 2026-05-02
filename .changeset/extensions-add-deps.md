---
"pstdio": minor
---

`pstdio extensions add` now installs dependencies in the copied extension folder when a `package.json` is present. Detection prefers the `packageManager` field, then a lockfile (`bun.lock`/`bun.lockb` → bun, `package-lock.json` → npm), then falls back to `npm install`. Adds `--install=<npm|bun>` to force a manager and `--skip-install` to skip the step. Widens the copy-time ignore list to also exclude `build`, `coverage`, `.cache`, `.parcel-cache`, `.vite`, `.svelte-kit`, `.nuxt`.
