# Check runtime support before using browser APIs

## 1. When to use

- Adding shared code that runs in browsers, Bun, or compiled CLI tools.

## 2. Failure

- The CLI used `EventSource` because its types were available, but the runtime did not implement it. Sync failed before connecting.

## 3. Prevention

- Check API support in each supported runtime; type checking alone cannot prove availability.
- Reuse the SDK's fetch-based server-sent event reader.
- Preserve authentication headers, cancellation, reconnects, and cursor handling when changing transport.

## 4. Evidence

- [SDK sync client](../../packages/sdk/src/client/sync.ts)
- [Shared SSE reader](../../packages/sdk/src/client/sse.ts)
