# Stream command results over the shared client stream

Proposed: 2026-10-06

## Context

PS-538 lets extension commands send live JSON chunks to webviews, SDK callers, and the CLI. The host owns transport and cancellation. Extensions own the meaning of each chunk.

The [shared stream architecture](../references/architecture/0021-stream.md) limits each client to two long-lived connections: table sync and one shared stream. One HTTP stream per command would exhaust Chromium's six HTTP/1.1 connections per origin. A socket per command would add another protocol and connection lifecycle.

## Decision

Command subscriptions use the existing `/v1/session-stream` connection. `createClient` owns its transport and passes it to both session and extension clients. Each subscription has its own cancellation controller. Closing a connection aborts every subscription. A dropped connection ends command streams; it does not replay them.

A command declares `stream: streamOf<T>()` and sends chunks with `await ctx.stream.write(chunk)`. Its return value remains the final command outcome. Ordinary calls discard chunks immediately. Middleware, workspace resolution, notices, and emitted event IDs use the existing command runner.

The webview bridge exposes `commands.stream` with `start`, `cancel`, and `ack` operations. The guest chooses the stream ID and listens before starting. The host publishes scoped data and end events. Each consumed chunk acknowledges its JSON byte count. These acknowledgements let the host count unread bytes; `postMessage` alone provides no consumption signal. Disconnect aborts streams and plain command HTTP requests owned by that frame.

## Limits and ownership

- The runner accepts at most 64 KiB of serialized JSON per chunk. A rejected chunk does not close the stream.
- The runner counts pending socket writes, including the in-flight write, against 256 chunks and 1 MiB. Writers wait for space and delivery. Authors must await writes.
- The SDK and frame each cap unread data at 8 MiB. Overflow cancels the stream.
- A frame owns at most 16 live streams. IDs and consumption acknowledgements are scoped to that frame.

These are resource limits, not throughput targets. The implementation tests token-sized and log-sized chunks, a blocked reader, and overflow. Browser validation opens ten simultaneous readers over one shared connection.

## Consequences

Live panels add no long-lived connections. CLI and webview callers use the same SDK transport. Streams cannot resume after disconnection, and hidden mounted panels keep running until cancelled. Paused or unmounted frames stop their work.

The route retains its existing name to preserve HTTP clients. A future route rename can be considered separately. This is the intended design, not a temporary workaround.
