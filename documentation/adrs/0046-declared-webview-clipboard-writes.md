# Let extension webviews write to the clipboard when they declare it

Proposed: 2026-09-27

## Status

Accepted and implemented. The dashboard delegates `clipboard-write` only for declared `clipboard.write`; desktop permission checks allow the matching runtime webview frames and continue to deny clipboard reads.

## Context at proposal time

Extension views run in sandboxed iframes. The dashboard previously gave each iframe `allow="fullscreen"` and a sandbox of `allow-scripts allow-forms allow-popups` (`packages/pstdio-dashboard/src/shared/extensions/components/extension-webview-surfaces.tsx:47-64`). The browser only lets an iframe call `navigator.clipboard.writeText` when the parent delegates `clipboard-write` through the `allow` attribute. Extension views therefore could not offer a working Copy button.

Copying text is a basic need for many tools: drafts, commands, ids, links. The social radar extension (PS-415) depends on it, and so will reports, notes and any tool that produces text for another app. An extension cannot fix this itself, because the iframe attributes belong to the host. Under mission rule 1 this belongs in the platform.

## Options

1. **Always delegate `clipboard-write`.** Simple, but every extension could overwrite the user's clipboard without saying so. This goes against the "limit what a tool may touch" rule.
2. **Host bridge call `clipboard.writeText`.** The guest asks the host, and the host writes. This fails in practice: after a click inside the iframe, the iframe holds focus, and browsers reject clipboard writes from a document that does not have focus.
3. **Declared capability that turns on iframe delegation.** Add `clipboard.write` to `WEBVIEW_DECLARABLE_CAPABILITIES`. The host adds `clipboard-write` to the iframe `allow` list only for webviews that declare it. The guest calls `navigator.clipboard.writeText` from its own click handler.

## Decision

Choose option 3.

- It follows the existing capability model (`packages/pstdio-api-contracts/src/extension-kernel/types/webview-capabilities.ts`). The grant is visible in the manifest and can be reviewed like any other.
- The write happens inside the iframe that the user clicked, so the browser's own focus and user-activation checks still apply.
- Only write is granted. Reading the clipboard stays blocked.

## Consequences

- An extension that declares `clipboard.write` can replace the clipboard contents while its view has focus. Browsers already limit this to documents with focus, which keeps abuse visible to the user.
- `pst extensions check` validates the new capability name like the others.
- The [desktop permission handler](../../clients/desktop/src/security/session-permissions.ts) grants `clipboard-sanitized-write` to permitted extension webview frames on their webview origin at the runtime port (see [ADR 0053](0053-per-extension-webview-origins.md)). Other subframes and clipboard reads remain denied.
