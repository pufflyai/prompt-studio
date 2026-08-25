# 0012. The webview client derives types from the commands record, not the extension definition

Date: 2026-08-25
Status: Accepted (temporary workaround)

## How the system should ideally work

`createWebviewClient<typeof extension>(host)` should derive every client type — command
keys, command params, command results, and settings — from one source: the value
returned by `defineExtension`. Extension authors would pass one type and get a fully
typed client.

## What external limitation prevents that

TypeScript cannot infer per-command result types at the `defineExtension` level without
breaking the typing of inline `run` handlers.

`defineExtension` types inline commands through a reverse mapped type
(`CommandDefinitions<TSchemas, TSettings>`). TypeScript "inverts" this mapped type to
infer each command's params schema, and then contextually types `ctx` inside each `run`
handler from that inference. Capturing result types needs a second inference variable
fed by the `run` return types. Every known formulation breaks this inversion:

- A conditional result map (`K extends keyof TResults ? TResults[K] : unknown`) stops
  the mapped type from being invertible, so `ctx.params` degrades to `Struct`.
- A second intersected mapped type (`CommandDefinitions<...> & CommandRunResults<...>`)
  breaks the contextual typing of `ctx`, with either a `never`, identical, or
  index-signature parameter type on the second member.
- A naked captured generic (`commands?: CommandDefinitions<...> & TCommands`) also
  breaks the contextual typing of `ctx`.
- An F-bounded constraint (`TCommands extends ValidCommands<TCommands>`) makes
  inference collapse to the generic's default entirely.

All four were verified against TypeScript 6.0.2.

## Why a clean solution is currently impossible

The result type only exists in the return type of `run`, which is a context-sensitive
function. TypeScript resolves context-sensitive functions after fixing the mapped-type
inference, so the same property cannot both receive contextual typing and feed a second
inference variable. This is a limit of the language, not of our API design.

## The chosen workaround and its trade-offs

`createWebviewClient<TCommands, TSettings>` takes two type sources the extension
already has:

- `TCommands`: the extension's exported commands record. `defineCommand` (one command,
  no mapped type) preserves schema and result types completely, and first-party
  extensions already author commands this way.
- `TSettings`: the extension's exported settings contribution (declared `as const`).

Trade-offs:

- Extensions must export their commands record and settings contribution instead of
  only the `defineExtension` result. Both are values they already build.
- Commands written as inline literals inside `defineExtension` (without
  `defineCommand`) keep untyped results. The cookbook documents `defineCommand` as the
  authoring convention.

## How the workaround is kept isolated

Only the type derivation in `packages/sdk/src/extensions/webview-client.ts` and the
authoring convention in `.pstdio/docs/extensions/cookbook.md` know about the two-source split.
The runtime client, the bridge, and the host are unaffected: they only see command ids.

## When and how to remove it

If TypeScript learns to combine reverse mapped-type inference with result capture (or
`defineExtension` moves to a builder API that types commands one at a time), change
`createWebviewClient` to accept `typeof extension` as its single type source and drop
the second type parameter. The runtime code needs no change.
