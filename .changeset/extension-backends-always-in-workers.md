---
"pstdio": patch
---

Every extension backend now runs in its own worker process. Prompt Studio no longer imports extension code into its API process, and `pstdio.backendRuntime` is no longer needed: packages that still set it load unchanged. `pst extensions check` no longer warns about the in-process runtime.

Workers start only when a handler first runs. Prompt Studio reads each extension version's contributions once and keeps them, so a restart with unchanged extensions starts no worker until one is used.

What changes for extension authors:

- Backend `process.env` is the environment that started Prompt Studio without its credentials: `PSTDIO_` names containing `TOKEN`, `SECRET`, `KEY`, `PASSWORD` or `CREDENTIAL`, anything starting with `NPM_CONFIG_`, `NPM_TOKEN`, `NPM_AUTH_TOKEN`, `NODE_AUTH_TOKEN` and `BUN_AUTH_TOKEN`. Code that read `PSTDIO_API_TOKEN` from `process.env` no longer finds it; `PSTDIO_HOME` and other settings stay. Provider keys, proxy and certificate settings are still there.
- Module state is no longer shared with Prompt Studio or between workers. Values on `globalThis` stay in the worker, and a worker that stops after 10 idle minutes, crashes or reloads starts with fresh module state.
- Contributions are read once per extension version, and a worker that reports a different definition than that first read is refused until the extension is loaded again. Compute values that depend on the time, the environment or other changing state in handlers instead.
- Handler arguments and results cross a process boundary. Functions, promises, streams and handles keep working; class instances arrive as plain objects.
- Cancelling a call settles it at once, without waiting for cleanup the handler still does in the worker after its signal aborts.
