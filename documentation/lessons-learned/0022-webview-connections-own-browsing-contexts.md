# Webview connections own browsing contexts

## When to use

- React retains, moves, remounts, or removes a webview backed by window-message RPC.

## Failure

- Effect cleanup can run while the same iframe browsing context is still alive.
  Closing the connection then breaks StrictMode or retained views.
- Skipping transport cleanup leaves the RPC library's host listeners and connection
  records alive after the iframe disappears. Repeated project changes retain old
  frames and add work to every later message.

## Prevention

- Give each iframe and captured `contentWindow` one connection owner. Reuse that
  owner when effects restart against the same browsing context.
- After effect cleanup, check detachment on a microtask. Close removed or replaced
  contexts; also close a handshake that finishes after its owner is disposed.
- Check listener counts after removing the actual frame, as well as across calls
  to a frame that remains mounted.

## Evidence

- [Bridge regression](../../packages/e2e/src/ui/extension-webview-bridge.p1.spec.ts):
  removing the project left 24 host listeners with no iframes before the fix; the
  same scenario returns to its empty-dashboard baseline afterward.
- [Connection ownership](../../packages/pstdio-extensions/src/bridge/host/frame-connection-lifetime.ts)
  preserves live contexts through effect cleanup and rejects late connections.
