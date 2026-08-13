# ADR: Temporary Direct Terminal WebSocket Endpoint

## Status

Accepted as a temporary workaround for Bun 1.3.13 and 1.3.14. The required fixes have landed on Bun's `main` branch, but they are not in the latest stable release as of August 13, 2026. Remove this workaround only after Prompt Studio pins a stable Bun release containing the fixes and the Vite terminal end-to-end test passes through the same-origin proxy.

## Decision

The dashboard runtime configuration may include a complete `terminalWebSocketUrl`. The terminal uses that endpoint unchanged when present. Otherwise it derives `/v1/terminal` from the configured API URL or the dashboard origin.

Dashboard servers inject this value while serving HTML. It is never compiled into dashboard assets. Normal HTTP API requests still use runtime API configuration or same-origin paths.

Vite development and preview derive the endpoint from the server-side `PSTDIO_API_URL`. A serving environment may set `PSTDIO_TERMINAL_WEBSOCKET_URL` when the browser needs a different reachable address, such as the host-mapped API port used by isolated Docker development. Vite does not proxy the terminal WebSocket.

The API treats the `Origin` header as part of terminal authorization. Same-origin requests remain valid. A cross-origin browser request is valid only when its exact origin appears in the server-only `PSTDIO_TERMINAL_ORIGINS` list. Requests without an `Origin` header remain available to native clients. Source and isolated development configure the Vite origin. Packaged and secure remote runtimes do not inject a direct endpoint and keep the existing same-origin security path.

## Context

The intended design is simple: the dashboard and API share one origin, and a development web server proxies both HTTP and WebSocket traffic. Packaged Prompt Studio already follows this design. PS-227 protected it by removing the build-time `VITE_API_BASE_URL`; packaged dashboard requests now use injected runtime configuration or their own origin.

The source dashboard and API run as separate processes. Vite proxies HTTP routes such as `/v1` and `/healthz` to the API. After PS-227, the terminal also used the dashboard origin. The existing Vite proxy does not opt into WebSocket handling, so `/v1/terminal` stopped connecting.

Enabling Vite's `ws: true` is unsafe with the pinned Bun versions. Bun's Node-compatible `node:http` client can expose an upstream `101 Switching Protocols` response through the normal `response` event instead of the Node `upgrade` event and raw-socket handoff. Vite's `http-proxy-3` code then enters its normal response path.

The server-side socket supplied by Bun for an HTTP upgrade is also not a complete Node `net.Socket`. In Bun 1.3.13 and 1.3.14 it can drop writes in this path and does not implement `destroySoon()`. When `http-proxy-3` reaches response or error cleanup and calls that method, it throws:

```text
TypeError: socket.destroySoon is not a function
```

The exception escapes Vite's proxy error handling and terminates the development server. The stack proves that Bun and `http-proxy-3` took the normal response cleanup path. It does not, by itself, prove that the API received a request without upgrade headers or returned a non-`101` response.

## Why the Ideal Design Is Not Available

The missing behavior is in Bun's Node compatibility layer. Prompt Studio cannot repair the client upgrade event, raw-socket handoff, and server upgrade socket inside Vite.

A local `destroySoon()` shim would only hide the last exception. It would not restore the upgrade handoff or reliable socket writes. Running Vite under Node works around Bun, but it adds a second JavaScript runtime to a Bun-only repository and to the isolated development image.

## Upstream Status

The upstream implementation has moved beyond the failure in Bun 1.3.14:

- [Bun PR #31587](https://github.com/oven-sh/bun/pull/31587) merged on June 17, 2026. It replaced the fetch-backed `node:http` client with a socket-based implementation using `node:net`, `node:tls`, and llhttp. The new client supports the Node `upgrade` event and raw-socket handoff for upgraded responses.
- [Bun PR #30664](https://github.com/oven-sh/bun/pull/30664) was closed as superseded after its author verified the more complete implementation on `main`. The current server path enables streaming, switches the connection to tunnel mode, detaches the HTTP parser, forwards buffered `head` bytes, emits `upgrade`, and keeps the connection alive until the socket closes.
- The dedicated [`destroySoon()` PR #26264](https://github.com/oven-sh/bun/pull/26264) was closed for inactivity rather than merged. However, the current [`NodeHTTPServerSocket`](https://raw.githubusercontent.com/oven-sh/bun/main/src/js/node/_http_server.ts) extends Bun's `net.Socket`, and the current [`net.Socket` implementation](https://raw.githubusercontent.com/oven-sh/bun/main/src/js/node/net.ts) defines `destroySoon()`. The upgrade socket therefore inherits the method that `http-proxy-3` calls.

The latest stable release is still [Bun 1.3.14](https://github.com/oven-sh/bun/releases), released on May 13, 2026. It predates these changes. The ADR does not assume which future Bun release will contain them.

This source-level evidence makes removal likely, but it does not prove Prompt Studio's complete path works. We have not yet passed the exact browser-to-Vite-to-`http-proxy-3`-to-PTY reproduction on a stable Bun version containing these changes.

## Trade-offs and Isolation

The workaround gives the browser a separate endpoint for one transport only. This means Vite terminal traffic can be cross-origin while normal API traffic stays same-origin. The API accepts the direct terminal handshake only from the exact configured Vite origins.

The workaround is isolated to:

- one optional dashboard runtime configuration field;
- the terminal session opener;
- the Vite HTML-serving adapter;
- exact terminal origin validation; and
- isolated development's browser-reachable port mapping.

It does not restore `VITE_API_BASE_URL`, alter REST routing, add credentials to URLs, enable Vite WebSocket proxying, or add a PocketCoder dependency.

Future remote workspaces remain provider-neutral. Prompt Studio clients connect to a Prompt Studio server. A PocketCoder integration should live behind the extension-owned workspace provider contract described by PS-28 and the cloud direction in PS-86. The extension owns its PocketCoder SDK or CLI dependency; browser transport code does not know about PocketCoder.

## Removal

When a stable Bun release containing the upstream changes is available:

1. Test that exact Bun version without changing the default configuration.
2. Omit the direct terminal endpoint and temporarily enable Vite's `ws: true` proxy.
3. Run the focused Vite terminal Playwright suite on every supported platform.

The test must cover the complete path from the browser through Bun-hosted Vite and `http-proxy-3` to the Prompt Studio API and a real PTY. It must exchange input and output, close the terminal, reload the dashboard, and open another terminal without the Vite process exiting.

Once that passes on every supported platform:

1. Enable same-origin WebSocket proxying in Vite.
2. Remove `terminalWebSocketUrl`, `PSTDIO_TERMINAL_WEBSOCKET_URL`, and `PSTDIO_TERMINAL_ORIGINS`.
3. Remove the Vite runtime HTML adapter if it has no remaining runtime fields.
4. Remove the direct terminal origin exception while keeping normal terminal origin validation.
5. Keep the terminal behavior test, but assert the same-origin WebSocket endpoint.
