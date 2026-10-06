# Temporary webview guest message filter

Proposed: 2026-10-06

## Intended behavior

An extension webview talks to the dashboard through a bridge. Only the host page that embeds the webview iframe may connect to it and call it. The transport library should enforce this on both ends. The host end already does: it accepts messages only from the iframe's own window.

## External limitation

The bridge uses [rimless](https://github.com/au-re/rimless) 0.8.2, the newest release. Its guest end accepts a `RIMLESS/HANDSHAKE_REPLY` from any window and keeps listening after the first handshake. It also accepts RPC requests from any window that knows the connection ID, and a forged handshake chooses that ID. The guest end cannot be configured to check `event.source`.

Any frame that can reach the webview window can therefore connect to it. This includes sibling webviews, a nested HTML artifact preview, and a sandboxed frame. It can then call `init` with its own module URL. The guest imports that module and mounts it with a host handle bound to the victim webview's declared capabilities, such as `commands.execute`. The PS-497 audit (finding 2) described this path, and the e2e spec `extension-webview-bridge.spec.ts` reproduced it in Chromium.

## Decision

Until rimless checks the sender, the guest bootstrap (`packages/pstdio-extensions/src/bridge/guest/bootstrap.ts`) adds a capture-phase `message` listener before it connects. The listener drops every message whose `action` starts with `RIMLESS/` unless `event.source === window.parent`. It stops the event before rimless sees it. Other messages, such as an extension's own messages to its nested frames, pass through unchanged.

The check uses window identity, not origin. The guest frame has an opaque origin and no trusted copy of the host origin, and only the host page can post a message whose `source` is the guest's parent window.

## Limitations

- The filter only protects the bootstrap's connection. Extension code that uses rimless directly in its own frames must check senders itself.
- A host page that is not the dashboard but embeds the webview runtime URL would pass the check. It cannot get a signed runtime URL, and its calls would reach only itself, not the real host.

## Removal

Remove the listener when a rimless release checks `event.source` against the guest's target window for the handshake and every RPC message, and removes its handshake listener after it connects. Upgrade rimless, delete `acceptBridgeMessagesOnlyFromHost`, rebuild the runtime bundle, and keep `extension-webview-bridge.spec.ts` passing.
