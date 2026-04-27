# CLI Harnesses

The `pstdio harnesses` command group manages executable AI coding tool providers in the extension platform.

## Command Summary

| Command | Purpose |
| --- | --- |
| `pstdio harnesses list` | List registered harness providers and availability. |
| `pstdio harnesses info <harness-id>` | Show provider diagnostics and setup state. |
| `pstdio harnesses setup <harness-id>` | Configure or install provider-owned assets. |
| `pstdio harnesses update <harness-id>` | Update provider configuration. |
| `pstdio harnesses remove <harness-id>` | Remove provider configuration. |
| `pstdio harnesses start <harness-id>` | Start a harness session for a workspace. |
| `pstdio harnesses send <run-id>` | Send follow-up input to a running harness. |
| `pstdio harnesses stop <run-id>` | Stop a running harness. |

## Ownership

- The kernel owns sessions and workspace records.
- Harness extension packages own executable detection, process start/send/stop behavior, and provider-specific setup.
- Project-owned provider configuration is stored through API-owned services.

## Provider Packages

First-party provider packages include:

- Claude Code harness provider
- OpenCode harness provider

Additional providers can be delivered as extension packages.

## Rules

1. Harness commands do not open the DB directly.
2. Provider behavior that mutates project state calls API services.
3. Provider-specific SDK helpers belong to the provider package, not `@pstdio/sdk`.
