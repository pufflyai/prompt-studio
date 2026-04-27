# Harnesses

Harnesses are the v2 extension boundary for executable AI coding tools such as Claude Code and OpenCode.

The kernel owns session records and API orchestration. Harness extension packages own executable detection, start, send, stop, and provider-specific process details.

## Architecture

```txt
┌───────────┐   ┌───────────────┐
│    CLI    │   │   Dashboard   │
└─────┬─────┘   └───────┬───────┘
      │                 │
      └────────┬────────┘
               │ HTTP
               ▼
       ┌───────────────┐
       │   pstdio-api  │
       │ /v1/harnesses │
       └───────┬───────┘
               │
               ▼
       ┌────────────────┐
       │ harness runtime │
       └───────┬────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
Claude Code        OpenCode
provider           provider
```

## Harness Provider Contract

Harness providers are registered by extensions.

```ts
type HarnessProviderDefinition = {
  id?: string;
  label: string;
  detect?(ctx): Promise<{ available: boolean; reason?: string }>;
  start(ctx, input: { workspacePath: string; sessionId: string; prompt?: string }): Promise<{ runId: string }>;
  send?(ctx, input: { runId: string; message: string }): Promise<void>;
  stop?(ctx, input: { runId: string }): Promise<void>;
};
```

## Ownership

| Concern | Owner |
| --- | --- |
| Session records and status | Kernel API |
| Workspace lifecycle metadata | Kernel API |
| Harness registry contract | Generic SDK/runtime |
| Claude Code executable behavior | Claude Code harness extension |
| OpenCode executable behavior | OpenCode harness extension |
| Provider-specific setup | Owning harness extension |

## CLI

Users interact with harnesses through `pstdio harnesses ...` commands.

## SDK Boundary

Generic harness provider shapes can live in `@pstdio/sdk/extensions`. Provider-specific helpers belong to the owning harness extension package.

## Data Boundary

Harness providers do not open the DB. Persisted session, workspace, activity, and sync state goes through API services.
