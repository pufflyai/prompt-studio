# Relay monitoring proposal

Synthetic UI source for Planner proposal PS-1281. This folder belongs to the existing design package; it does not install or implement the proposed repository-local extension.

- Canvas: `Proposals/PS-1281 Relay monitoring`.
- Frame: `Interactive`.
- Open Overview, Checks, Storage, Failures, Infrastructure and Connection within the same frame.
- Use the frame editor's `condition` selector to explore healthy, storage-failure, stale, disconnected and setup states. Reset the frame to clear temporary interactions.
- Environments, measurements, events and connection outcomes are fixtures. Refresh and connection actions change local preview state only.
- Shared UI comes from `@pstdio/ui`, including data tables and their TanStack-backed sparkline cells. No production component imports this folder.

With repository/design dependencies installed, check this source from the repository root:

```sh
bun check design/proposals/PS-1281
bun x biome check design/proposals/PS-1281
bun x pstdio-canvas build
```

The proposal's handoff records a focused Canvas build and any unrelated whole-catalog failures. Never commit generated Canvas modules.

The implementation should move the reviewed UI into `.pstdio/extensions/relay-monitor/`, connect it through the public extension interfaces, and remove this proposal folder. Preserve any intervening shared-component changes.
