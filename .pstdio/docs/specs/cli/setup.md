# Runtime and API Setup

## Purpose

Define how the CLI starts and stops the local API process and dashboard runtime.

---

## Automatic API Start

Any command that needs the API ensures it is running before execution.

- If the API is already running, the command proceeds immediately.
- If the API is not running, it is started automatically in the background.
- The background API process persists after the command exits.
- Auto-start can be disabled by setting `PSTDIO_DISABLE_API_AUTO_START=1`. In that mode, the user must start the API manually.

Commands that auto-start the API:

- `projects create`
- `projects link`
- `projects list`
- `agents list`
- `agents setup`
- `agents remove`

Commands that do not auto-start:

- `close`

---

## `pstdio close`

### Usage

```sh
pstdio close
```

### Flags

None.

### Behavior

- If the API is running, it is shut down gracefully and prints `"API stopped."`.
- If the API is not running, it prints `"API is not running."` and exits normally.

---

## `pstdio` (Dashboard Mode)

### Usage

```sh
pstdio --api-port 3000 --dashboard-port 5555
```

### Flags

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--api-port` | `number` | `3000` | API server port. |
| `--dashboard-port` | `number` | `5555` | Dashboard server port. |

### Behavior

- Starts both the API and dashboard web server in the foreground.
- Runs the API as a managed child process; API output is visible in the terminal.
- Shuts down both processes when the user exits (`Ctrl+C`).
- Opens the dashboard automatically in the default browser.

---

## Errors

| Message | Cause |
| --- | --- |
| `"Could not start the pstdio API. Start it manually or check your installation."` | Auto-start failed because the API binary was not found. |
| `"Service at <url> did not become healthy within 15000ms"` | The API started but did not become responsive in time. |
