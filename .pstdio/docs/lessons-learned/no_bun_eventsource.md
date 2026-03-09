# No Built-in EventSource in Bun

## Problem

Bun does not provide a global `EventSource` class. The [Bun docs](https://bun.com/reference/bun/EventSource) reference it, but as of Bun 1.3.10 it is not implemented.

## Impact

The sync client (`packages/pstdio/src/features/sync/sync-client.ts`) connects to the API's SSE stream for real-time state updates. It originally used `new EventSource(url)`, which fails at runtime with `ReferenceError: EventSource is not defined`.

## Solution

The sync client uses `fetch` + `ReadableStream` to consume the SSE stream instead. This is natively supported by Bun and requires no external dependencies.

The SSE text protocol is parsed manually: frames are split on `\n\n`, and each frame's `event:` and `data:` fields are extracted.

## If Bun adds EventSource

Once Bun ships a built-in `EventSource`, the fetch-based implementation can be replaced with it for simplicity. No functional change would be needed — the SSE protocol is the same either way.
