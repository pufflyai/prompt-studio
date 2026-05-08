# Tests

This repository runs several layers of tests, and not all of them exercise real agent binaries.

## Default Validation Flow

`bun run validate` runs:

```bash
bun run format
bun run lint
bun run build
bun run test
```

`bun run test` resolves to `lerna run test`, so it includes package test scripts across the monorepo, including `packages/e2e`.

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
