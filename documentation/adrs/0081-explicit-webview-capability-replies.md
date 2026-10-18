# Explicit webview capability replies

Proposed: 2026-10-18

Status: Accepted

## Context

Webview capability errors carry a product code, message and optional data. Authors use those
fields to handle a denied capability, invalid input, or an unavailable host service.

The bridge currently rejects an RPC call with a JavaScript Error. The RPC library serializes
that error using its own property rules. Nested data can lose fields. The guest then keeps
only the message. The extension API needs one stable error contract across every host.

## Decision

The internal capability-call protocol returns a discriminated reply:

- `{ ok: true, value }` for a completed capability call.
- `{ ok: false, error: { code, message, data? } }` for a failed capability call.

The host bridge owns the reply. The capability gate and host services supply product errors.
The guest unwraps the reply and raises an Error carrying the code and data. The public
`GuestHost.call` result stays unchanged. SDK callers can narrow errors through a structural
type guard, including errors created by another bundle.

Command outcomes remain values inside a successful capability reply. Their own rejected and
failed states retain the complete command outcome contract.

This wire contract belongs to Prompt Studio. It remains useful with any RPC library because
it describes the product result explicitly. Host and guest runtime code ship together; the
protocol is internal and adds no manifest flag or stored state.

## Consequences

Each capability result has one small transport wrapper. Nested error data travels through the
same returned-value path as other structured bridge data. Boot and connection failures keep
the existing runtime-error path.

Tests cover gate denial codes, service errors, nested data and actual opaque webviews. Future
RPC changes must preserve this reply contract and the public GuestHost behavior.
