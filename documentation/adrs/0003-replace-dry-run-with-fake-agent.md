# Test agent sessions through the real lifecycle

Proposed: 2026-03-13

Status: Accepted. Consolidates ADR 0002's rejected dry-run shortcut.

## Context

- Real agents in E2E tests consumed tokens and changed project files.
- `PSTDIO_DRY_RUN` avoided execution but skipped session creation, process tracking, message patches, SSE delivery, persistence, and cleanup. Passing tests therefore missed lifecycle failures.

## Decision

1. Exercise the production session lifecycle with controlled agent behavior.
2. Use the [workbench fixture](../../packages/workbench-fixture/) and controlled executables through [isolated API setup](../../packages/e2e/src/cli/start-api.ts). Select the qualified fixture harness ID supplied by that setup.
3. Keep test-only early returns out of production session orchestration.

## Consequences

- Tests cover completion, persistence, replay, follow-up, and cleanup without LLM calls or unintended file changes.
- Controlled providers require maintenance.
- The original `PSTDIO_AGENTS=fake` setting and fake-agent type union are historical; extension harnesses replaced them.
