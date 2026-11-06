# Resource scope does not own an event connection

## When to use

When adding or changing live resource observations, editor lifetimes, or client transports.

## Failure

Retained editor presentations each opened an HTTP event stream. Table sync and five editors occupied all six browser HTTP/1.1 connections to the host. File loads, close requests, and destination project metadata queued indefinitely. Releasing editor streams immediately restored ordinary requests.

Per-editor authorization, membership, and leases are logical ownership. They do not justify separate physical connections. Sharing the host-to-relay connection proves nothing about the browser-to-host connection. Small editor-pair and unit-only tests missed resource accumulation. Native cancellation also carried a numeric `DOMException.code`, which crashed a codec that assumed every error code was a string.

## Prevention

- [One SDK client transport](../../packages/sdk/src/client/client.ts) carries sessions, commands, text guests, and native-document observations. Table sync owns the only other event connection. Keep project/token/room permissions on each logical subscription.
- [Boundary verification](../../scripts/verify/client-event-transport.ts), invoked by `verify:boundaries`, rejects event-stream creation outside the approved client transport owners. Finite asset downloads remain supported.
- Run the [mixed-resource HTTP/1.1 browser regression](../../packages/e2e/src/ui/resource-stream-budget.p1.spec.ts) before completing resource or transport changes. Count actual event responses, including unknown future endpoints, and prove ordinary requests complete with retained resources, late admission cancellation, pending edits, reconnects, and project switching.
- Keep [native cancellation normalization](../../packages/sdk/src/extensions/text-editing-codec.p0.test.ts) and [scoped host subscriptions](../../packages/pstdio-api/src/features/native-documents/shared-stream.p0.test.ts) covered alongside the existing close and lease recovery tests.

## Evidence

The [streaming contract](../references/architecture/0021-stream.md) defines the connection budget and protocols. [ADR 0065](../adrs/0065-stream-command-results-over-the-shared-client-stream.md) records why logical subscriptions share one physical stream.
