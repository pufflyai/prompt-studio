# ADR: Replace `PSTDIO_DRY_RUN` With Fake Agent

Proposed: 2026-03-13

## Status

Accepted.

**Supersedes:** [ADR 0002](0002-superseded-dry-run-flag.md)

## Decision

Remove the `PSTDIO_DRY_RUN` short-circuit behavior and use a fake `AgentService` implementation that exercises the full session lifecycle.

At proposal time, test environments loaded the fake agent through `PSTDIO_AGENTS=fake`, and tests created sessions with `agent: "fake"`.

## Context

`PSTDIO_DRY_RUN` avoided real agent execution by returning early in `spawnAgentSession` and `resumeAgentSession`.

That shortcut skipped the core lifecycle:

- session store creation and process tracking
- event store patch emission and SSE delivery
- process exit handling
- session message persistence
- cleanup on completion

As a result, important behavior was not covered in e2e even though tests were passing.

## Original implementation

| Before                                                               | After                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| `spawn-agent.ts` had `if (process.env.PSTDIO_DRY_RUN)` early returns | No dry-run branch; lifecycle always executes           |
| Test API used `PSTDIO_DRY_RUN=1`                                     | Test API uses `PSTDIO_AGENTS=fake`                     |
| E2E sessions used real agent IDs (`opencode`)                        | E2E session creation uses `agent: "fake"`              |
| Lifecycle paths were bypassed in e2e                                 | Full spawn → stream → persist → exit path is exercised |

## Trade-offs

### Gains

- Deterministic tests without LLM calls
- Real lifecycle coverage in e2e
- Cleaner production code without test-only branching in session orchestration

### Costs

- `AgentId` includes `"fake"` and requires handling in type-level maps
- Additional fake provider implementation to maintain

## Current implementation

The principle still applies: exercise the real lifecycle with controlled provider behavior. The host now discovers extension harnesses; `PSTDIO_AGENTS=fake` is no longer a supported selection mechanism. E2E uses the [workbench fixture](../../packages/workbench-fixture/) and controlled executables through [isolated API setup](../../packages/e2e/src/cli/start-api.ts). Use the qualified fixture harness ID supplied by that setup. The original fake-agent union and configuration below describe the earlier implementation only.

## Validation

Validated with `bun run validate` and regression tests covering:

- session completion and persistence
- SSE patch replay
- follow-up/resume behavior with fake agent
