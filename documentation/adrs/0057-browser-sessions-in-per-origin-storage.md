# Browser sessions in per-origin storage

Proposed: 2026-10-06

Status: Accepted in PS-513. Consolidates ADR 0054's browser-session decision and its replacement of cookies.

## Context

- A page load formerly exposed the runtime token through a cookie. Any process able to reach the port could obtain full API access, including terminals.
- A separate browser cookie still leaked to other localhost ports and was replayable with a forged `Host` header. Two runtimes also overwrote each other's cookie.
- Browser credentials must stay on the exact runtime origin, including its port.

## Decision

1. Page loads never sign a browser in. The runtime token stays in mode-0600 `runtime.json`; it never reaches browser pages or URLs.
2. Give the browser a separate random secret per runtime process. Keep it in `localStorage`, scoped to the exact origin. Do not use cookies.
3. Send the secret as `Authorization: Bearer <secret>` for REST and fetch-based SSE. One credential reader accepts either the runtime token or browser secret; `Host` is not authentication.
4. For terminals, offer WebSocket subprotocols `pstdio` first and `pstdio.bearer.<secret>` second. Select only `pstdio` so the secret is not echoed. A real Bun handshake test protects this ordering.
5. Only the runtime token can issue login codes through `POST /runtime/browser-login`. Codes are single-use and expire after 60 seconds.
6. Put the code in `<origin>/#browser-login=<code>`. On any dashboard path, remove that fragment from the address bar and exchange it through `POST /runtime/browser-session`. Return the secret with `Cache-Control: no-store`; store it before continuing.
7. Both the desktop shell and `pst` use this flow. `pst --open-browser=false` prints the link for another browser or port forwarding.
8. Fetch displayed API files with authentication and show them as blob URLs; plain images and links cannot attach the header.
9. A runtime restart invalidates the secret. A `401` from `/runtime/ready` shows the sign-in page. Used, invalid, or expired codes do not establish a session.

## Consequences

- Tabs on one origin share their session; different runtime ports stay separate. A replacement runtime on the same port replaces the stored secret after sign-in.
- Same-origin script can copy the secret. Extension webviews remain sandboxed without `allow-same-origin`, so they cannot read dashboard storage.
- The desktop's in-memory partition loses its secret when the app quits. Older cookie-based desktop clients cannot attach to newer runtimes; desktop and CLI ship together.
- Tokenless standalone servers still have no runtime sign-in routes.

## Rejected alternatives

- Cookie names per port and dedicated localhost hostnames still send credentials to another port. Header checks cannot repair a secret already leaked.
- `sessionStorage` requires sign-in for each new tab. A service worker adds lifecycle complexity for file requests.
- First-message WebSocket authentication accepts an unauthenticated upgrade and duplicates auth in the terminal route.
- Fragment exchange keeps codes out of request logs and referrers, improving on the original server-side login redirect.
