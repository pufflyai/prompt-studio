# Test retained page identity in compiled output

## When to use

- A retained React view disappears, expires, and later returns with the same logical ID.
- A render reads mutable host identity through a helper outside React state.

## Failure

- Home appeared twice after returning from Canvas once its 30-minute retention expired.
- The host list inserted current content twice: once through retained placements, then
  through a redundant conditional lookup. React Compiler cached that second lookup
  while Canvas was active. Returning Home inserted both the new host key and the
  cached, released key, mounting two visible copies of the same page.
- Source-only previews and short navigation round trips did not reproduce the failure.

## Prevention

- Build the host list from retained placements once; they already include current content.
- Cover both retention reuse and reopening after expiry with a virtual clock.
- Exercise public compiled package exports when a failure depends on React Compiler.
  Keep the fixture outside package aliases that redirect those imports to source.

## Evidence

- [Compiled Canvas fixture](../../packages/e2e/src/fixtures/page-return.canvas.tsx).
- [Page return regression](../../packages/canvas-tests/src/ui/pstdio-workbench/page-return.p1.spec.ts)
  received two Home views before the fix and one afterward; it also preserves draft
  state before expiry and verifies a fresh view after expiry.
- [Host ownership](../../packages/pstdio-workbench/src/react/region/panel-view-hosts.tsx).
