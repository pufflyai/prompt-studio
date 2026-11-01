# ADR: Temporary command response type binding

Proposed: 2026-10-18

Status: Accepted temporary workaround.

## Intended design

Command execution validates the kernel outcome union once and returns that same contract through
HTTP. The OpenAPI route and its handler should share the contract without a cast.

## External limitation

Hono's `JSONParsed` conditional type recursively maps response data. The validated command union
includes recursive JSON causes and metadata. Assigning the inferred `c.json` handler to the
OpenAPI route expands that mapping beyond TypeScript's instantiation limit (TS2589). The SDK,
contracts and runtime type checks accept the union; the failure occurs at this HTTP type binding.
Changing the public outcome or dropping causes to satisfy that mapping would weaken the contract.

## Decision

Use `c.body(JSON.stringify(response), 200, { "Content-Type": "application/json" })` for the
successful command response. This keeps headers prepared on the Hono context. Keep the route's shared schema
and the runtime's validated result. Bind this one handler through `unknown` to its OpenAPI handler
type, as existing notification handlers do. This avoids a second recursive type expansion.

The cast is isolated to the execute-command endpoint. It does not alter the runtime payload,
validation, status codes, or SDK types. Contract tests reject contradictory outcomes; real HTTP
and packaged checks prove that full rejections survive the boundary.

## Limitations

The compiler cannot prove that this handler's serialized response matches the OpenAPI response. Its
runtime validation and integration tests own that check until the binding can be inferred directly.

## Removal

Remove the binding cast and use the ordinary typed Hono response when the supported Hono and
TypeScript versions can assign the shared recursive outcome without TS2589. Keep the full outcome
and existing tests when checking that change.
