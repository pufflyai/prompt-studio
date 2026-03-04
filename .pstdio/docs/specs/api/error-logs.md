# API Spec: Error Logs

## Purpose

Capture API errors as structured JSON — written to stderr for compatibility with log aggregators, and persisted to `~/.pstdio/error-logs/` for local debugging.

---

## Structured Log Format

All log entries are newline-delimited JSON (NDJSON) written to stderr. This is the universal format consumed by Datadog, Grafana Loki, ELK, CloudWatch, and every major log aggregator.

```json
{
  "level": "error",
  "timestamp": "2026-03-04T12:00:00.000Z",
  "method": "POST",
  "path": "/v1/tickets",
  "status": 500,
  "message": "Project not found: abc-123",
  "stack": "Error: Project not found: abc-123\n    at TicketsService.create ..."
}
```

| Field       | Type     | Description                                          |
| ----------- | -------- | ---------------------------------------------------- |
| `level`     | `string` | Always `"error"` for error logs.                     |
| `timestamp` | `string` | ISO 8601 timestamp of the error.                     |
| `method`    | `string` | HTTP method of the request that triggered the error. |
| `path`      | `string` | Request path.                                        |
| `status`    | `number` | HTTP status code returned.                           |
| `message`   | `string` | Error message.                                       |
| `stack`     | `string` | Full stack trace.                                    |

---

## Local File Persistence

When running locally, error logs are also written to `~/.pstdio/error-logs/` for easy inspection.

```text
~/.pstdio/
  error-logs/
    2026-03-04T12-00-00Z.json
    2026-03-04T12-05-23Z.json
```

- One file per error, named by ISO 8601 timestamp (colons replaced with hyphens for filesystem safety).
- Each file contains the same JSON object written to stderr, pretty-printed for readability.
- Max **50 log files**. When the limit is reached, delete the oldest file before writing a new one.

---

## What Gets Logged

Log **unhandled errors** that result in a 5xx response. Do not log:

- 4xx client errors (validation failures, not found, etc.)
- Successful responses
- Expected/handled error paths

---

## Implementation

### Log Module

A single module at `packages/pstdio-api/src/lib/error-log.ts` with two responsibilities:

1. **`logError(entry)`** — writes the JSON line to stderr via `process.stderr.write()`.
2. **`persistErrorLog(entry)`** — writes the pretty-printed JSON file to `~/.pstdio/error-logs/`. Handles directory creation and file rotation.

No external dependencies. No logging library.

### Global Error Handler

Add a global Hono error handler via `app.onError()` in the app factory:

```ts
app.onError((err, c) => {
  const entry = {
    level: "error",
    timestamp: new Date().toISOString(),
    method: c.req.method,
    path: c.req.path,
    status: 500,
    message: err.message,
    stack: err.stack,
  };

  logError(entry);
  persistErrorLog(entry);

  return c.json({ error: "Internal server error" }, 500);
});
```

### Deployed vs Local

| Concern         | Local                                      | Deployed                                    |
| --------------- | ------------------------------------------ | ------------------------------------------- |
| stderr (JSON)   | Always written                             | Always written — collected by infrastructure |
| File persistence | Written to `~/.pstdio/error-logs/`        | Disabled (no local filesystem)              |

File persistence can be toggled off via an environment variable (e.g. `PSTDIO_DISABLE_FILE_LOGS=true`) when deployed.

---

## CLI Integration (Future)

A future `pstdio logs` command could:

- List recent error logs from `~/.pstdio/error-logs/`.
- Display a specific log by timestamp.
- Clear all logs.

This is out of scope for the initial implementation.

---

## Errors

- If `~/.pstdio/error-logs/` cannot be created or written to, log a warning to stderr and continue without crashing the API. Error logging must never cause a secondary failure.
