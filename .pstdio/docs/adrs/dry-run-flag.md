# ADR: PSTDIO_DRY_RUN environment variable

## Decision

Add a `PSTDIO_DRY_RUN` environment variable to the API server. When set, `spawnAgentSession` and `resumeAgentSession` skip agent execution and immediately mark the session as completed.

## Context

E2E tests create sessions via `POST /v1/sessions` to test UI flows (navigation, session list rendering, status updates). The `createSessionHandler` calls `spawnAgentSession`, which launches a real agent process (OpenCode or Claude Code) against the repository.

This meant every E2E test run spawned multiple real AI agents that made actual changes to the codebase — burning tokens, mutating files, and creating noise (e.g. "Navigation test session" branches).

The tests only need a session record in the database with the correct status transitions. They do not need the agent to actually run.

## What changes

| Before                                       | After                                                             |
| -------------------------------------------- | ----------------------------------------------------------------- |
| E2E `POST /sessions` spawns a real agent     | E2E `POST /sessions` creates the DB record and marks it completed |
| Agent processes modify the repo during tests | No agent processes are spawned                                    |

### Implementation

- `spawn-agent.ts`: both `spawnAgentSession` and `resumeAgentSession` check `process.env.PSTDIO_DRY_RUN` at the top. If truthy, they update the session status to `completed`, emit the event, and return early.
- `packages/e2e/src/cli/start-api.ts`: passes `PSTDIO_DRY_RUN: "1"` when spawning the test API server.

## Trade-offs

### Lost: E2E coverage of real agent lifecycle

Tests no longer exercise the full spawn → stream → exit flow. Agent integration must be tested separately (manual or dedicated agent-level tests).

### Gained: safe, fast, deterministic E2E tests

No real agents running, no token spend, no file mutations, no flaky agent timeouts.
