# ADR: Browser sessions in per-origin storage

Proposed: 2026-10-06

## Status

Accepted in PS-513. Supersedes the cookie parts of [ADR 0054](0054-browser-sessions-for-the-local-runtime.md): how the browser stores its session secret, how it sends it, and how `pst` and the desktop shell hand it over. ADR 0054 still holds for the rest: a page load never signs a browser in, the secret is its own random value per runtime process and never the runtime token, and only bearer holders can sign a browser in.

## Context

ADR 0054 gave the browser its own session secret in the `pstdio_runtime_session` cookie, a host-only cookie on `127.0.0.1`. Browsers do not scope cookies by port, and `SameSite` ignores the port. So the browser sent the secret to every other server on `127.0.0.1`: a project dev server, an agent-built tool, or a container port. That server could call the runtime with the cookie and `Host: 127.0.0.1:<runtime port>`. The runtime accepted it because it read the request origin from the `Host` header, which any client controls. The caller then had every REST route and the terminal WebSocket until the runtime restarted (PS-497 audit, finding 9).

Two runtimes on `127.0.0.1` in one browser also overwrote each other's cookie, because they used the same cookie name and path.

The rule that broke: only pages on the runtime's own origin may present the browser credential. A cookie cannot enforce that rule on `127.0.0.1`, because the browser attaches it by host name alone. No cookie attribute and no request header check fixes this. A server that received the cookie can replay it with any headers it wants.

## Decision

The browser keeps its session secret in storage that the browser scopes to the exact origin, including the port. The runtime does not use cookies at all.

1. **Storage.** The dashboard keeps the secret in `localStorage`. A page on another port has another origin and cannot read it, and the browser never attaches it to a request on its own.
2. **Sending it.** The dashboard sends the secret as `Authorization: Bearer <secret>` on REST requests and on the sync stream (SSE over `fetch`). Browsers cannot set headers on a WebSocket, so the terminal offers two subprotocols: `pstdio` first and `pstdio.bearer.<secret>` second. The server selects `pstdio`, so the secret is never echoed back.
3. **Checking it.** The runtime reads one credential from the `Authorization` header or, if that is missing, from the `pstdio.bearer.` subprotocol. It accepts the runtime token or the browser secret. The `Host` header is no longer part of the check. Only the runtime token can create login codes.
4. **Signing in.** A bearer holder calls `POST /runtime/browser-login`. The runtime returns `<origin>/#browser-login=<code>`. The code is single-use and expires after 60 seconds. It sits in the URL fragment, so it never reaches the server, request logs, or the `Referer` header. When the dashboard loads with this fragment on any path, it removes the fragment from the address bar and calls `POST /runtime/browser-session` with `{ "code": "…" }`. The runtime spends the code and returns `{ "secret": "…" }` with `Cache-Control: no-store`. The dashboard stores the secret and continues.
   - `pst` opens the link, or prints it with `--open-browser=false`, as before.
   - The desktop shell creates a link the same way and loads it in its workbench window. It no longer sets a cookie in its session.
5. **Files.** Browsers cannot add a header to an `<img>` or a plain link. The dashboard fetches files it shows from the API, such as session attachments, with the header and shows them as `blob:` URLs.

## Consequences

- Other local servers never receive the secret. A forged `Host` header does not help a caller that has no secret.
- Two runtimes on different ports have different origins, so they keep separate sessions in one browser. A newer runtime on the same port replaces the stored secret when the browser signs in again.
- Script on the dashboard origin can read the secret, which an `HttpOnly` cookie prevented. Script on that origin could already use the whole API, including the terminal, so the new exposure is that it can also copy the secret elsewhere. Extension webviews run in sandboxed frames without `allow-same-origin`, so they cannot read the dashboard's storage. If webviews move to their own `ext-<hash>.localhost` origins (PS-477), they still cannot, because storage is per origin.
- All tabs on the runtime origin share the session, as they shared the cookie. The desktop workbench uses an in-memory session partition, so the secret is gone when the app quits.
- A runtime restart creates a new secret. The stored secret then gets `401`, and the dashboard shows the page that tells the person to run `pst`, as before.
- One credential reader serves REST, SSE, and WebSocket handshakes. The terminal route needs no auth code of its own.
- The subprotocol order matters: Bun selects the first protocol the client offers. A test on a real Bun server checks that the terminal handshake authenticates and the selected protocol is `pstdio`.
- An older desktop app expects a cookie and cannot attach to a newer runtime. The desktop app and the CLI ship in one release, as ADR 0054 already required.

## Alternatives considered

- **Serve the dashboard on a dedicated host name such as `pstdio.localhost`.** Its cookie would not go to `127.0.0.1` servers, but cookies still ignore the port. A local server can be reached as `pstdio.localhost:<its own port>`. After one redirect there, its own page is same-site with the dashboard host, and the browser sends it the `SameSite=Strict` cookie. A random name per runtime would leak through the `Origin` and `Referer` headers of any page the dashboard loads. This option also changes the runtime origin contract for the CLI, the desktop shell, the descriptor, and the origin checks, and it depends on every client resolving `*.localhost` names. Rejected.
- **Use a cookie name per port.** This stops the overwrite but still sends the secret to every other port. Rejected.
- **Use `sessionStorage`.** It is per tab, so every new tab or "open in new tab" would need a new sign-in. `localStorage` keeps the behavior people had with the cookie. Rejected.
- **Add the header to images and navigations with a service worker.** It covers `<img>` and links, but adds registration, update, and first-load timing problems for a few attachment images. Rejected.
- **Authenticate the terminal with its first WebSocket message.** The runtime would have to accept unauthenticated upgrades and move auth into the terminal route. Rejected.
