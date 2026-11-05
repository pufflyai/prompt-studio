# Temporary OpenCode command discovery readiness

Proposed: 2026-11-05

Status: Accepted.

## Decision

Before reading OpenCode 2's native command catalog, read its provider catalog for the same directory. Keep this ordering inside the OpenCode command adapter and its existing discovery cache.

## External limitation

OpenCode 2.2.5 starts location plugins asynchronously. Its `GET /api/command` handler reads the current catalog without waiting for activation. A first request can return an empty list, including when the directory contains configured commands. `GET /api/provider` waits for plugin activation and returns a bounded error when activation fails. There is no separate public readiness endpoint for location plugins.

The intended design is one command-catalog request that waits for its own dependencies. The published `@opencode/server` 2.2.5 handlers confirm the difference: `server.command` calls `command.list()` directly, while `server.provider` first awaits `Plugin.awaitActivation`.

## Limitations

Each command discovery cache refresh makes one extra local request. Provider data is discarded and is never logged. No retry loop or fixed delay is added.

## Removal

Remove the provider request when the minimum supported OpenCode version waits for plugin activation in its command handler, or exposes a dedicated readiness operation. Keep the real installed-CLI command discovery test.
