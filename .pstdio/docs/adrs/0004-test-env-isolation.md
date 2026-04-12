# ADR: Test Environment Isolation via Bun Preload

## Decision

Preload [scripts/test-setup.ts](../../../scripts/test-setup.ts) in every package that runs `bun test`. The setup file scrubs ambient `PSTDIO_*` variables from `process.env` at preload time and snapshot/restores `process.env` around every test.

The preload is wired through a per-package `bunfig.toml`:

```toml
[test]
preload = ["../../scripts/test-setup.ts"]
```

## Context

A test in `packages/pstdio/src/adapters/cli/commands/workspace/set-status.test.ts` was passing on clean shells but failing consistently inside worktrees launched from IDE integrations. The root cause was a leaked environment variable:

- The test wired `env: () => process.env` into its fake dependencies.
- The command under test falls back to `PSTDIO_SESSION_ID` when no session id is supplied on the CLI.
- Worktree shells inherit `PSTDIO_SESSION_ID` from the parent process, so the test was observing developer-machine state.

The failure looked flaky but was deterministic — same code, same Bun, different ambient environment. The same failure mode could occur for any test that reads `process.env` or forgets to restore a variable it mutated.

We want a fix that kills the whole class of bug, not just this one test.

## What changes

| Before | After |
| --- | --- |
| Tests inherit the full parent shell env, including `PSTDIO_*` vars exported by IDE integrations | `PSTDIO_*` vars are stripped at preload; tests start from a clean baseline |
| Tests that mutate `process.env` without `try/finally` leak state into later tests in the same file | `process.env` is snapshot in `beforeEach` and restored in `afterEach` |
| No shared test-time setup | `scripts/test-setup.ts` preloaded via per-package `bunfig.toml` in 11 packages |

## How it works

The setup file does two things:

1. **At preload (once per `bun test` invocation):** walk `process.env` and delete any key starting with `PSTDIO_`. This kills ambient leakage from the parent shell before any test code runs.
2. **Around every test:** `beforeEach` snapshots `process.env`; `afterEach` restores keys that were deleted and removes keys that were added. The snapshot is taken inside `beforeEach` (not at module load) so that variables set by `beforeAll` or describe-level setup are preserved — only per-test mutations are reverted.

Tests that legitimately set `PSTDIO_*` variables to exercise env-driven code paths (e.g. `pstdio-logging`, `pstdio-db` paths, `pstdio-api` logging/workspace endpoints) continue to work: they set the variable inside the test, the handler reads it, and `afterEach` cleans it up automatically.

## Why per-package `bunfig.toml`

Bun's test runner loads `bunfig.toml` from the current working directory and `$HOME/.bunfig.toml` — it does not walk up the directory tree. Since `lerna run test` invokes `bun test` inside each package's own cwd, a single root `bunfig.toml` would be ignored.

Alternatives considered:

- **`--preload` flag in each `package.json` test script** — same number of edits, but spreads configuration across `package.json` files that also contain unrelated scripts. The `bunfig.toml` keeps test configuration in a dedicated file.
- **Symlink a root `bunfig.toml`** — works but obscures which configuration applies where.
- **Lint rule banning `process.env` in `**/*.test.ts`** — Biome's `noProcessEnv` rule is available and was evaluated. Rejected because ~14 existing test files legitimately mutate `process.env` to test env-driven code. Banning it outright would force a refactor to test helpers across unrelated packages without a matching safety benefit once the preload is in place.

## Trade-offs

### Gained: deterministic tests across machines and shells

The set-status bug and its class are fixed without any changes to the tests themselves. A developer running `bun test` from a worktree with `PSTDIO_SESSION_ID` exported now gets the same result as CI.

### Gained: free cleanup for env-mutating tests

Tests that set `process.env.FOO = "bar"` no longer need `try/finally` blocks to restore state. The `afterEach` handles it. Existing `try/finally` guards are still correct, just redundant.

### Cost: 11 new `bunfig.toml` stubs

Every package that runs `bun test` needs the config file. This is the first time the repo has needed a shared test preload, so most packages did not previously have a `bunfig.toml` (only `packages/e2e` did, for a timeout bump). If future shared test configuration is needed, it now has a home.

### Cost: `process.env` snapshot on every test

Negligible — `{ ...process.env }` is cheap and the test suite shows no measurable overhead.
