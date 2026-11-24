# Temporary OpenCode command discovery readiness

Proposed: 2026-11-05

Status: Accepted.

## Decision

Use OpenCode's plugin inventory for the same directory as the catalog request. Wait for the inventory to populate before reading native commands or reading models from OpenCode 2.4 and later. If a provider is missing from an account snapshot, wait for the inventory before reading that snapshot again.

## External limitation

OpenCode 2.2.5 starts location plugins asynchronously. Its `GET /api/command` handler reads the current catalog without waiting for activation. A first request can return an empty list, including when the directory contains configured commands. `GET /api/provider` waits for plugin activation and returns a bounded error when activation fails. There is no separate public readiness endpoint for location plugins.

The published `@opencode/server` 2.2.5 handlers confirm that `server.command` reads the current catalog while `server.provider` waits for activation. OpenCode 2.4 also returns the current model and provider catalogs while plugins load. Its [release notes](https://opencode.ai/changelog/v2.4.0) direct one-shot clients to wait for the plugin inventory to populate. A standalone request terminates its server before plugins can finish loading.

## Limitations

Catalog discovery uses the existing OpenCode GET deadline and the harness-owned server. Any plugin data read to check readiness is discarded. Model discovery for earlier supported versions uses the existing standalone request.

## Removal

Use a dedicated public readiness operation when OpenCode provides one. Keep the real installed-CLI model, authentication and command discovery checks.
