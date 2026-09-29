# Check runtime support before using browser APIs

## What went wrong

The CLI sync client used `new EventSource(url)` and failed with `ReferenceError: EventSource is not defined`. A browser API appearing in type definitions did not mean the Bun runtime implemented it.

The original failure occurred with Bun 1.3.10. A local check with Bun 1.4.2 still returns `undefined` for `typeof EventSource`.

## Current implementation

The CLI and dashboard use the shared SDK sync client. It reads server-sent events (SSE) through `fetch` and `ReadableStream`, with request headers, cancellation, reconnects, and a sync cursor owned by the SDK.

- [SDK sync client](../../packages/sdk/src/client/sync.ts)
- [Shared SSE reader](../../packages/sdk/src/client/sse.ts)
- [CLI sync adapter](../../packages/pstdio/src/features/sync/sync-client.ts)

## Key takeaway

Check browser API support in each supported runtime before using it in shared code. Keep the stream transport in the SDK so callers use the same behavior. Any future transport replacement must preserve headers, cancellation, reconnects, and cursor handling.
