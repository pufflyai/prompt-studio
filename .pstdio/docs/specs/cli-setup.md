# CLI: API & Database Setup

The pstdio CLI relies on a local API server backed by an embedded database. This document describes how the API is started, where data is stored, and how commands ensure the API is available.

---

## Automatic API Start

Any command that needs the API ensures it is running before executing. This is transparent to the user.

- If the API is already running, the command proceeds immediately.
- If the API is not running, it is started automatically in the background.
- The background API process persists after the command exits, so subsequent commands are instant.
- Auto-start can be disabled by setting `PSTDIO_DISABLE_API_AUTO_START=1`. In that case, the user is responsible for starting the API manually.

**Commands that auto-start the API:** `projects create`, `projects link`, `projects list`, `agents list`, `agents setup`, `agents remove`.

**Commands that do NOT auto-start:** `tui`, `close`.

---

## `pstdio close`

Stop the background API process.

```
pstdio close
```

**Flags:** none

**Behavior:**

- If the API is running, it is shut down gracefully. Prints `"API stopped."`.
- If the API is not running, prints `"API is not running."` and exits normally.

---

## Dashboard Mode

The `pstdio` command (default, no subcommand) starts both the API and a dashboard web server in the foreground.

- The API runs as a managed child process — its output is visible in the terminal.
- Both the API and dashboard shut down together when the user exits (`Ctrl+C`).
- The dashboard opens automatically in the default browser.

```
pstdio --api-port 3000 --dashboard-port 5555
```

| Flag               | Type     | Default | Description            |
| ------------------ | -------- | ------- | ---------------------- |
| `--api-port`       | `number` | `3000`  | API server port.       |
| `--dashboard-port` | `number` | `5555`  | Dashboard server port. |

---

## Errors

| Message                                                                           | Cause                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `"Could not start the pstdio API. Start it manually or check your installation."` | Auto-start failed — the API binary was not found. |
| `"Service at <url> did not become healthy within 15000ms"`                        | The API was started but never became responsive.  |
