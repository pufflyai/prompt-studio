# Tests

This repository runs several layers of tests, and not all of them exercise real agent binaries.

## Tiers

| Tier | What it covers | Where it runs |
| --- | --- | --- |
| Unit | `bun test` in each package | `bun run validate`, CI |
| Mount-smoke | Storybook test-runner against every `*.stories.tsx` | CI |
| UI E2E (Playwright) | Active specs in `packages/e2e/src/ui/` against the workbench dashboard | `bun run validate`, CI |
| CLI E2E (Bun) | `packages/e2e/src/cli/` against an in-process API | `bun run validate`, CI |
| Packaged E2E | `packages/e2e/src/packaged/` against the bundled CLI artifact | CI |

## Default Validation Flow

`bun run validate` runs:

```bash
bun run validate:changesets
bun run verify:lockfile
bun run format
bun run verify:boundaries
bun run verify:quarantine
bun run lint
bun run build
bun run test
```

`bun run test` resolves to `lerna run test`, so it includes package test scripts across the monorepo, including `packages/e2e`.

## Storybook Mount-Smoke Tier

CI runs `@storybook/test-runner` against the built static storybook bundle for
`@pstdio/ui`. Every story is mounted in a Playwright browser; the run fails on
any runtime error during render. Stories that declare a `play` function also
run their play body.

Local invocation:

```bash
bun run --cwd packages/ui test-storybook:smoke
```

The runner builds storybook first; pass `SKIP_STORYBOOK_BUILD=1` to reuse an
existing `storybook-static/` directory. Pass `STORYBOOK_SMOKE_PORT=<n>` to
move off the default `6006` if it is taken locally.

### `mount-smoke-skip` tag

Stories tagged `mount-smoke-skip` are excluded from the runner. The tag exists
so a single flaky play test does not block the gate. Every use must:

- name a tracking ticket in an adjacent comment, and
- carry a clear plan to remove the tag.

The skip list is enforced by `.storybook/test-runner.ts`.

### Adding play coverage

See `storybook-play-coverage.md` for the inventory of stories that still lack a
`play` body. The contract is: add a `play` smoke when you touch a story file,
and never let the mount-smoke tier go red.

## E2E Quarantine Policy

The active UI Playwright spec list lives in `packages/e2e/src/quarantine.ts`.
Specs in that list are skipped while the dashboard surface they exercise is
rebuilt on the workbench runtime. The baseline of allowed quarantined specs is
`packages/e2e/quarantine-baseline.json`.

`bun run verify:quarantine` (also run as a step in `bun run validate` and the
CI workflow) fails if a pattern shows up in the quarantine list but is not in
the baseline. Quarantine should only ever shrink.

The definition of done for any ported dashboard feature includes:

1. Move the relevant spec out of `packages/e2e/src/quarantine.ts`.
2. Remove the matching entry from `packages/e2e/quarantine-baseline.json`.
3. Make the spec pass against the new workbench-based dashboard.

If you genuinely need to widen quarantine (e.g. a temporary regression while a
dependency lands), document the reason in the PR and update the baseline in
the same change.

## Extension UI Preview Seam

`packages/pstdio-extension-testbench` is the sanctioned preview seam for
extension UIs. New extensions should ship a testbench preset (see the
toolbar in the running testbench) so contributors can mount and exercise
the extension surface without booting the full dashboard. Treat the
testbench preset as the place where extension renderers get their
mount-smoke coverage.

```bash
bun run extension:bench:workbench
```

## E2E Defaults

The `packages/e2e` package runs:

```bash
bun run test:cli
bun run test:ui
```

### CLI E2E

CLI e2e tests start the API through `packages/e2e/src/cli/start-api.ts`.

That helper forces:

```bash
PSTDIO_AGENTS=fake
PSTDIO_HOME=<temp-dir>
PSTDIO_DB_PATH=:memory:
PSTDIO_DEFAULT_EXTENSIONS=[]
```

So CLI e2e coverage does not start real Claude Code or OpenCode sessions.

### UI E2E

UI e2e tests run through Playwright using `packages/e2e/playwright.config.ts`.

By default Playwright starts the API with:

```bash
PSTDIO_AGENTS=${E2E_AGENTS:-fake}
PSTDIO_HOME=<temp-dir>
PSTDIO_DB_PATH=:memory:
PSTDIO_DEFAULT_EXTENSIONS=[]
```

That means:

- Plain `bun run validate` uses the `fake` agent for UI e2e.
- Default UI session creation paths spawn fake sessions only.
- Default UI coverage does not start Claude Code sessions.

## Agent Flags

Use `E2E_AGENTS` to opt into a different agent for Playwright UI tests.

### Fake

```bash
bun run --cwd packages/e2e test:ui
```

Equivalent explicit form:

```bash
E2E_AGENTS=fake bun run --cwd packages/e2e test:ui
```

This is the safe default used by `validate`.

### Claude Code

```bash
E2E_AGENTS=claude-code bun run --cwd packages/e2e test:ui
```

This unskips the Claude-specific Playwright specs:

- `packages/e2e/src/ui/session-follow-up-completion-claude.spec.ts`
- `packages/e2e/src/ui/session-follow-up-ordering-claude.spec.ts`

Those specs configure the `claude-code` agent and do start real Claude sessions.

If Claude is not on your `PATH`, provide a custom binary:

```bash
E2E_AGENTS=claude-code E2E_CLAUDE_BINARY=/absolute/path/to/claude bun run --cwd packages/e2e test:ui
```

### OpenCode

```bash
E2E_AGENTS=opencode bun run --cwd packages/e2e test:ui
```

This unskips the OpenCode follow-up Playwright coverage and starts real OpenCode-backed sessions.

## Useful Test Commands

Run all e2e:

```bash
bun run test:e2e
```

Run UI e2e only:

```bash
bun run --cwd packages/e2e test:ui
```

Run a single Playwright spec:

```bash
bun run --cwd packages/e2e test:ui -- src/ui/session-follow-up-completion-claude.spec.ts
```

Run headed:

```bash
bun run --cwd packages/e2e test:ui -- --headed
```

## What Can Still Touch Real Binaries

Even when tests do not start a real Claude session, some non-e2e tests may still probe local agent availability.

Examples:

- Claude availability checks can call `claude --version`.
- OpenCode availability checks can call `opencode --version`.
- CLI agent listing can call `which claude` or `which opencode`.

Those checks verify installation state only. They do not create or resume agent sessions by themselves.

## Practical Rule

If you run `bun run validate` with no extra environment variables, the test suite should not start Claude Code sessions.

If you set `E2E_AGENTS=claude-code`, you are explicitly opting into real Claude-backed Playwright session tests.
