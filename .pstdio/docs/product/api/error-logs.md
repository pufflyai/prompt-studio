---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: API and Runtime Logs

## Summary

Prompt Studio emits structured runtime logs (API, hooks, CLI mutating commands, and lifecycle events) through a shared `pino` logger to a configurable JSONL target.

By default, logs are written to `<resolved-state-dir>/logs.jsonl` where state-dir resolution follows the same configuration pattern as DB/storage path resolution.

## Problem

Operators need one canonical event stream for debugging cross-surface flows without relying on ad hoc console output.

## Goals

- Document the shared runtime logging contract.
- Keep the doc aligned with the shipped implementation.
- Keep path resolution rules explicit and configuration-driven.

## Non-Goals

- Shipping remote log shipping in this scope.
- Building a dedicated log viewer UI in this scope.

## Overview

Runtime packages use a shared logger package (`pstdio-logging`) that:

1. Resolves the log destination from configuration.
2. Emits newline-delimited JSON entries.
3. Applies default redaction for sensitive fields.

The API still emits structured error entries on unhandled failures and returns a generic 500 response body.

## Requirements

### Functional Requirements

1. Runtime events must be emitted as structured JSONL entries through the shared logger.
2. API request lifecycle and unhandled errors must be included in the shared log stream.
3. Hook invocation + outcome events must be included in the shared log stream.
4. CLI mutating command lifecycle events must be included in the shared log stream.
5. The default file target must resolve from configured state paths, not a hardcoded home path.

### UX Requirements

- Log entries should be inspectable as JSONL on disk and tail-friendly in terminal workflows.
- API clients should still receive a generic `Internal server error` response body.

### Operational Requirements

- Entries should include timestamp, level, component, event, and message.
- Context fields should be attached when available (for example `project_id`, `ticket_id`, `workspace_id`, `session_id`).

## Behavior

1. Runtime code emits structured events via shared logger APIs.
2. The logger writes one JSON object per line to the resolved target.
3. API `onError` emits a structured error entry and returns `{ "error": "Internal server error" }` with status 500.

## Interface

### Error Log Entry

```json
{
  "service": "pstdio-api",
  "component": "api",
  "event": "api.request.error",
  "timestamp": "2026-03-04T12:00:00.000Z",
  "level": "error",
  "method": "POST",
  "path": "/v1/tickets",
  "status": 500,
  "message": "Project not found: abc-123",
  "stack": "Error: Project not found: abc-123\n    at ..."
}
```

## Rules & Constraints

- This contract focuses on structured runtime events and path/config behavior.
- Additional targets can be added without changing call sites.
- API failure response behavior remains unchanged.

## Errors

Runtime failures are emitted as structured entries in the shared logger stream (`stdout` and configured JSONL targets).

## Verification & Evidence

- **Commands to run**: `sed -n '1,260p' packages/pstdio-logging/src/index.ts`, `sed -n '1,260p' packages/pstdio-api/src/app.ts`, `sed -n '1,260p' packages/pstdio/src/index.ts`
- **Expected evidence**: Runtime surfaces emit structured JSONL entries via shared logger and API still returns generic 500 payloads on unhandled errors.
- **Where to find artifacts**: `packages/pstdio-logging`, `packages/pstdio-api`, `packages/pstdio-plugins`, `packages/pstdio`
