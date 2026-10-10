# Browser tests

Run the dashboard suite with `bun run --cwd packages/e2e test:ui`.

`src/ui-server.ts` owns the dashboard suite's origin. Playwright derives its server binding,
health check, browser URL, and terminal allowlist from that value. The runner supplies the
free port through `E2E_API_PORT`.

Use relative URLs with Playwright's `request` fixture. When a helper needs an absolute URL,
import `uiOrigin` from `src/ui-server.ts`. Do not rebuild the host or port in a dashboard spec
or helper. Change the shared origin when the test server address needs to change.
`bun run verify:boundaries`, included in CI and `bun run validate`, rejects copied loopback
hosts and server port environment reads in dashboard and Vite terminal configs, specs, and helpers.

The Vite terminal suite starts separate API, development, and preview servers. Their origins
are defined in `src/vite-terminal-servers.ts` and shared by its configuration and tests.

## Performance suite

Run the frontend performance suite with `bun run --cwd packages/e2e perf:frontend`. The script
builds the dashboard and its dependencies, then starts the same isolated `pstdio serve` server
as the dashboard suite. `src/serve-web-server.ts` defines that server for both configurations.
Use `perf:frontend:trace` to record Playwright traces.

Each spec in `src/perf` measures one interaction under 4x CPU throttling. Set `CPU_THROTTLE`
to change the rate and `PERF_REPEAT_EACH` to change the number of repeats (default 3). The page
stamps both the input event and the settled state, so Playwright waits never add to a sample.
Reports list every sample with its median and range, and the budget applies to the slowest
sample.
