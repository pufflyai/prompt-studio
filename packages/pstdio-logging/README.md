# pstdio-logging

Shared structured logging primitives for `pstdio` runtime packages.

## Defaults

- Logger engine: `pino`
- Default log level: `error`
- Always-on target: `stdout`
- Default supplemental target: `<resolved-state-dir>/logs.jsonl`
- Format: newline-delimited JSON

`<resolved-state-dir>` follows the same configuration style used by DB/storage paths:

1. `PSTDIO_STATE_DIR` (or explicit `stateDir`)
2. parent directory of `PSTDIO_DB_PATH` (or explicit `dbPath`) when not `:memory:`
3. parent directory of `PSTDIO_STORAGE_PATH` (or explicit `storagePath`)
4. fallback `~/.pstdio`

`PSTDIO_LOG_PATH` (or explicit `logPath`) overrides the file path directly for the `file` target.

`~` expansion is supported for all path inputs.

## Usage

```ts
import { createLogger } from "pstdio-logging";

const logger = createLogger({
  service: "pstdio-api",
  component: "api",
});

logger.info(
  {
    event: "api.request.completed",
    method: "GET",
    path: "/healthz",
    status: 200,
  },
  "API request completed",
);
```

## Targets

- `stdout` is always included and cannot be disabled.
- Supplemental targets via explicit config: `createLogger({ targets: [...] })`
- Supplemental targets via env: `PSTDIO_LOG_TARGETS=file,stdout`
- Supplemental target precedence:
  1. `createLogger({ targets })`
  2. `PSTDIO_LOG_TARGETS`
  3. default supplemental target = `file`
- When supplemental targets are configured explicitly (via API or env), they replace the default supplemental file target.
- Supported target kinds today:
  - `file`
  - `stdout`

Future target kinds can be added without changing call sites.

## Runtime Controls

- Log level is controlled through `PSTDIO_LOG_LEVEL` (for example `PSTDIO_LOG_LEVEL=debug`).
- Default runtime level is `error` when `PSTDIO_LOG_LEVEL` is not set.
- There is currently no CLI `--loglevel` or `--log-level` flag.

## Future Sink Example

Keep runtime logging stdout-first and extend supplemental sinks later:

```ts
createLogger({
  service: "pstdio-api",
  targets: [
    { type: "file", path: "/var/log/pstdio/logs.jsonl" },
    // Future extension point (example only):
    // { type: "loki", endpoint: "https://loki.example.com" }
  ],
});
```

## Redaction

Sensitive keys are redacted by default, including:

- `authorization`
- `token`
- `api_token`
- `apiToken`
- `secret`
- `password`
