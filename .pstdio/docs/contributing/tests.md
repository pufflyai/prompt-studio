# Tests

## Validation

Use Bun 1.3.14 and Node 24, matching CI. Install dependencies with `bun install --frozen-lockfile`. The root pins `node-gyp` so native addon install scripts use the local build tool instead of a temporary `bunx node-gyp@latest` download.

Native CI installs use `scripts/ci/install-native-dependencies.ts`. On Linux and macOS it gives node-gyp the headers already installed with Node. This removes another download from native addon builds. The setting applies only to dependency installation; Electron packaging selects the headers for Electron separately.

The version-scoped Playwright patch gives its API request agents Node's normal five-second idle socket expiry. This prevents later request contexts from reusing expired connections. It does not retry failed requests. ADR 0027 records the external limitation and removal criteria. Docker build stages copy `patches/` with the lockfile so frozen installs apply the same dependency fixes. Patch edits invalidate Nx caches and trigger native packaged verification.

`bun run validate` checks changesets, the lockfile, formatting, package boundaries, and extension API versions. It builds the monorepo before checking translations, linting, and testing. Translation validation and type checks load compiled SDK exports, so the build must come first on a clean checkout. Formatting is checked without changing files.

`bun run test` runs package tests through Lerna, followed by the E2E script, CLI, UI, and Vite terminal suites. Packaged and desktop tests run separately in CI.

```bash
bun run validate
bun run --cwd packages/e2e test:scripts
bun run --cwd packages/e2e test:cli
bun run --cwd packages/e2e test:ui
bun run --cwd packages/e2e test:vite-terminal
bun run --cwd packages/e2e test:packaged
bun run --cwd scripts verify:packages
```

Install browser dependencies before running browser tests:

```bash
bun run --cwd packages/e2e playwright install --with-deps chromium firefox webkit
```

For manual app validation, use `bun run dev:playwright`, open the printed dashboard URL, and stop it with `bun run dev:playwright:down`. Do not start a development server directly or use the developer database.

## Isolation

Bun tests preload `scripts/test-setup.ts`. It removes inherited `PSTDIO_*` runtime settings, creates a temporary home, and restores the environment around each test. Tests that need runtime settings must supply them inside their setup or to the process they start. Do not run tests that mutate `process.env` concurrently in one process.

The UI and Vite launchers also remove inherited runtime settings. Each run allocates loopback ports and uses an isolated home and in-memory database. Test controls use the `E2E_` prefix:

- `E2E_PACKAGED_BINARY_PATH` selects an already built binary for packaged tests. The package verifier sets it to the host-compatible release artifact.
- `E2E_REQUIRE_WEBVIEW_BROWSERS=1` makes missing packaged-test browsers fail instead of skip. CI sets it.
- `E2E_BUN_CACHE_DIR` chooses the runtime install cache. Without it, UI runs use a cache per run.
- `E2E_RUN_ID` selects the UI and Vite report directory.

Nx test inputs include the shared preload, root Bun configuration, lockfile, and Bun version. Changing these invalidates cached test results.

Global preferences survive project deletion. Browser specs that read or change notifications use the test fixture in `src/ui/helpers/notification-settings.ts` and opt in with `test.use({ notificationsEnabled: true })` when needed. The fixture restores the previous preference during teardown.

Packaged desktop specs import `test` from `clients/desktop/src/testing/packaged-fixture.ts`. The fixture owns launched process groups and temporary homes. Its teardown runs after a test timeout, even when an unfinished CDP operation prevents the test body from reaching its own cleanup.

Compiled builds generate an empty PostgreSQL database image with the installed PGlite version. New, empty database directories load that image before running the normal Drizzle migrations. Nonempty directories always open their existing files, including damaged databases that need recovery. This moves PostgreSQL initialization into the build and reduces cold startup. PGlite documents this approach in its [pre-populated filesystem guide](https://pglite.dev/docs/prepopulatedfs).

Tests install local fixture extensions from `packages/e2e/src/default-extensions.ts`. Select `pstdio.workbench-fixture.harness.fake` for ordinary session tests. A Planner attempt starts a session; `startSession: false` is not a supported command parameter. Tests for a real provider must supply a controlled executable or explicitly opt into live integration tests.

## Browser coverage and failures

Playwright uses one worker and no retries. CI rejects focused Playwright tests (`test.only`). UI and Vite traces are recorded on the first run and retained on failure. This follows [Playwright's trace modes](https://playwright.dev/docs/test-use-options#recording-options).

CI runs CLI E2E and three browser shards in separate jobs. Each shard has its own runtime, home, and database. Files stay intact and use one worker, so ordered tests share no state across runners. Every shard and the CLI job must pass before Docker builds start. Each UI shard uploads `ui-e2e-results-<shard>`; the packaged/Vite job uploads `packaged-vite-e2e-results`. Reports and failure artifacts are under `packages/e2e/playwright-report` and `packages/e2e/test-results`. Desktop jobs upload their own readiness results and traces.

Linux UI, CLI, and packaged/Vite jobs use the official `mcr.microsoft.com/playwright:v1.60.0-noble` image. They run as user 1001, matching the owner of GitHub's mounted home directory; Firefox rejects a root process using that user's home. The image includes browser binaries and system libraries, so these jobs do not install Ubuntu packages or browsers during setup. Keep the image version aligned with the installed Playwright version when updating dependencies. Desktop jobs still run on their native Linux and macOS runners.

The browser container installs the root manifest's Bun version with `scripts/ci/setup-container-bun.ts`. This temporary bootstrap uses Bun's official registry archive because the normal setup action requires `unzip`, which the image lacks. ADR 0026 describes when to remove it.

The UI suite has no migration quarantine list. Obsolete dashboard specs were removed. Current tests cover project selection, ticket workflows, session follow-ups, workspace files and terminals, extension lifecycle, and workbench navigation. Add coverage for restored features against the current UI. Live Claude, Codex, and OpenCode follow-up tests skip unless `E2E_AGENTS` selects the provider. Packaged browser checks cover Chromium, Firefox, and WebKit; the main UI suite covers Chromium.

To investigate a failure, keep retries disabled and repeat the affected spec:

```bash
bun run --cwd packages/e2e test:ui -- src/ui/ticket-workflows.spec.ts --repeat-each=5
```

To run one CI shard locally, use `bun run --cwd packages/e2e test:ui -- --shard=2/3`. Keep the same shard total when comparing runs.

Read the first failure and its trace. Check setup, teardown, and server logs before attributing the failure to an assertion. Storybook startup failures include the tail of the server output. Readiness checks must cancel stalled HTTP requests within their deadline.

Keep the existing job and test time limits. A timeout needs a performance investigation. A passing rerun alone does not explain the failure.

## Live provider tests

These commands opt into real agent sessions:

```bash
E2E_AGENTS=claude-code bun run --cwd packages/e2e test:ui -- src/ui/session-follow-up-completion-claude.spec.ts
E2E_AGENTS=opencode bun run --cwd packages/e2e test:ui -- src/ui/session-follow-up-ordering-opencode.spec.ts
```

They require the selected provider and its credentials. They are separate from ordinary fixture-based CI coverage.
