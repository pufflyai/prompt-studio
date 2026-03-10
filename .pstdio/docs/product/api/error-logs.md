---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: API Error Logs

## Summary

The API logs unhandled server errors as structured JSON to stderr and also persists a local copy to `~/.pstdio/error-logs`.

## Problem

Operators need structured error output for terminal debugging and local investigation without relying on ad hoc console logs.

## Goals

- Document the current error-log contract.
- Keep the doc aligned with the shipped implementation.
- Remove stale claims about deployment-only toggles that are not implemented.

## Non-Goals

- Logging 4xx request failures.
- Shipping a full log browser in the product today.
- Documenting behavior behind environment flags that do not exist.

## Overview

Unhandled API errors resolve through the app-level Hono `onError` handler. The handler builds one log entry, writes it to stderr as a single-line JSON object, persists a pretty-printed copy to disk, and returns a generic 500 response body.

## Requirements

### Functional Requirements

1. Every unhandled 5xx error must emit one structured stderr log line.
2. The same error entry must be persisted as JSON under `~/.pstdio/error-logs`.
3. Local error-log storage must retain only the 50 most recent files.
4. Error-log persistence must never crash the API if filesystem writes fail.

### UX Requirements

- Error logs should be readable in terminal output and inspectable on disk.
- API clients should still receive a generic `Internal server error` response body.

### Operational Requirements

- The entry schema must include request method, request path, timestamp, status, message, and optional stack.
- Persistence failures must be reported to stderr.

## Behavior

1. A request throws an unhandled error.
2. The app-level `onError` handler builds an error entry with request metadata.
3. `logError` writes one NDJSON line to stderr.
4. `persistErrorLog` writes a pretty-printed JSON file to `~/.pstdio/error-logs/<timestamp>.json`.
5. If more than 50 files exist, the oldest files are deleted.
6. The API returns `{ "error": "Internal server error" }` with status 500.

## Interface

### Error Log Entry

```json
{
  "level": "error",
  "timestamp": "2026-03-04T12:00:00.000Z",
  "method": "POST",
  "path": "/v1/tickets",
  "status": 500,
  "message": "Project not found: abc-123",
  "stack": "Error: Project not found: abc-123\n    at ..."
}
```

## Rules & Constraints

- Only unhandled server-side failures are part of this product contract.
- The current implementation always attempts local file persistence; there is no shipped disable flag.
- Persistence failure is logged but does not change the API response contract.

## Errors

| Error | Cause |
| ----- | ----- |
| `Failed to persist error log: <message>` | The filesystem write or cleanup step failed. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio-api/src/lib/error-log.ts`, `sed -n '130,180p' packages/pstdio-api/src/app.ts`
- **Expected evidence**: The API writes NDJSON to stderr, persists JSON files locally, rotates after 50 files, and returns a generic 500 payload.
- **Where to find artifacts**: `packages/pstdio-api/src/lib/error-log.ts`, `packages/pstdio-api/src/app.ts`
