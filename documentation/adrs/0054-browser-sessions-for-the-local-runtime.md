# ADR: Browser sessions for the local runtime

Proposed: 2026-10-06

## Context

The local runtime protects its API with the token in `runtime.json`. That file has mode 0600, so only the user's own processes can read it.

Before this decision, every dashboard page load from the runtime origin set the `pstdio_runtime_session` cookie, and the cookie value was the runtime token itself. The check compared only the request URL origin, which comes from the `Host` header that any client controls. Any process that could open a TCP connection to the port could send `GET /` and read the token from `Set-Cookie`. This included another OS account, a sandboxed agent that cannot read the home folder, and a container that can reach host loopback ports. With the token, a client has the whole API, including the terminal WebSocket. The audit in PS-497 (finding 1) confirmed this against a live runtime.

Cookies are not scoped by port, and `SameSite` ignores the port. So the same cookie also went to every other local web server on `127.0.0.1`, which could replay it as a bearer token (finding 9).

## Decision

1. A page load never signs a browser in. The serve process sends dashboard HTML without a cookie.
2. The browser cookie carries its own random secret, created per runtime process. It is never the runtime token. The runtime accepts it only as a cookie on the runtime origin, never in an `Authorization` header. A restart creates a new secret.
3. Only bearer holders can give a browser this cookie:
   - The desktop shell calls `POST /runtime/browser-session` with the token. The response sets the cookie in the desktop's session, as before.
   - `pst` calls `POST /runtime/browser-login` with the token. The runtime returns a login URL with a single-use code that expires after 60 seconds. `pst` opens that URL. `GET /runtime/browser-login?code=…` spends the code, sets the cookie, and redirects to `/`. The code is spent only on the exact runtime origin.
4. A used, unknown, or expired code still redirects to `/`. The dashboard checks `/runtime/ready` before it renders. A `401` shows a page that tells the person to run `pst`.

The token never reaches the browser, a URL, or the page.

## Consequences

- A local process that cannot read `runtime.json` can no longer get a credential just by loading a page from the port.
- `pst` also prints the login link when it does not open a browser (`--open-browser=false`), so a browser on another machine, for example over SSH port forwarding, can still sign in once.
- The cookie is still not scoped by port. A browser sends it to every other server on `127.0.0.1`, and a non-browser client can replay it with any `Host` header. A leaked cookie grants the same API access as the browser until the runtime restarts. This is audit finding 9, still open and tracked in PS-513; the fix is to move the credential out of the port-shared cookie jar, for example with a dedicated host name.
- Opening the bare runtime URL, a bookmark, or a link in a browser without a session shows the sign-in page instead of the dashboard. Running `pst` signs the browser in again. This is also needed after every runtime restart, because the secret changes.
- A browser tab that stays open across a runtime restart loses its session, as it already did when the token changed.
- A desktop app attached to a persistent runtime started by an older CLI still works. It only checks that the cookie is `HttpOnly` and `SameSite=Strict`. An older desktop app expects the token as the cookie value, so it cannot attach to a newer persistent runtime. The desktop app and the CLI ship in one release.
- Standalone servers without a token are unchanged: they have no runtime routes and need no sign-in.

## Alternatives considered

- **Keep the page-load cookie but check the `Origin` header.** Navigations send no `Origin`, and non-browser clients can send any header. Rejected.
- **Put the code in the URL fragment and exchange it with a `POST` from the dashboard.** This keeps the code out of request lines, but adds auth code to the dashboard. The code is single-use, short-lived, and never logged, so a server-side redirect is simpler. Rejected for now.
- **Serve the dashboard on a dedicated host name such as `pstdio.localhost`.** This would keep the cookie away from other `127.0.0.1` servers, but it changes the runtime origin contract for the CLI, desktop, and descriptor. It needs its own design, so it is left to PS-513. Until then, a leaked cookie can be replayed until the runtime restarts.
