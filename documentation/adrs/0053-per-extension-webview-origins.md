# Serve extension webviews from per-extension origins

Proposed: 2026-10-03

## Status

Accepted in PS-477. Supersedes the opaque-origin parts of [ADR 0008](0008-capability-secured-extension-webview-assets.md).

## Context

Extension webviews ran in sandboxed iframes without `allow-same-origin`, so every webview had an opaque `null` origin. That had three costs:

- Browser storage did not work. The guest runtime replaced `localStorage` and `sessionStorage` with in-memory copies, and IndexedDB and cookies were unavailable.
- An extension could not embed a third-party web app. Nested frames inherit the opaque sandbox, so an app such as the pen.dev editor crashes on its first `document.cookie` read.
- The asset routes needed special `null`-origin CORS rules, and a second, unused static webview surface existed beside the bridged one.

Adding `allow-same-origin` to the old iframes was not safe: the runtime document was served from the dashboard's origin, so extension code would have gained the dashboard's storage and API session.

## Decision

Each installed extension's webviews run on their own origin: `http://<label>.localhost:<port>`. The label is `ext-` plus the first 24 hex characters of the SHA-256 of the installed extension id. Browsers resolve `*.localhost` to loopback without DNS, so these origins work offline.

- **One way to render a webview.** The shared `ExtensionFrame` uses `allow-scripts allow-same-origin allow-forms allow-popups`. It connects the bridge before setting the iframe `src`, so rimless accepts the handshake only from that iframe's window on that origin.
- **The API owns the origin rule.** On a webview host, the API answers only `/v1/extensions/webviews/*`, and only for the extension the host label names. The dashboard host never serves webview resources. `pstdio serve` sends every webview-host request to the API, never the dashboard page.
- **The server names the origin.** Dashboard config carries `webviewOrigin`, for example `http://*.localhost:19840`. `pstdio serve` derives it from the address the browser used. Vite derives it from the API it proxies to, or takes `PSTDIO_WEBVIEW_ORIGIN`, so webviews load straight from the API like the terminal does.
- **Capability URLs stay.** ADR 0008's signed URLs still authorize reads, so other local pages cannot read webview assets.
- **Relative artifact URLs.** Artifact image URLs stay relative and resolve on the webview's own origin.
- **Desktop.** The window CSP allows `frame-src http://*.localhost:*`, and clipboard writes are allowed from webview subframes on a webview host at the runtime port.
- **Extension testbench.** It follows the same model on its own API port.

## Consequences

- Webviews get real `localStorage`, `sessionStorage`, IndexedDB, and same-origin workers. The in-memory storage copies and the `null`-origin CORS rules are removed.
- Storage belongs to one installed extension and is shared by all its webviews and projects. Extensions must key project data by project.
- An origin includes its port. The runtime binds an ephemeral port today, so browser storage resets when the port changes.
- An extension can embed third-party web apps, which keep their own origins.
- In Electron, each extension with an open view now runs in its own renderer process, separate from the workbench. The performance monitor uses this to show CPU for each extension (PS-477). The cost is one renderer process for each extension with open views.
- A webview still cannot reach the dashboard document, the API session, or the terminal. Webview hosts serve nothing else, and the dashboard origin rejects cross-origin API calls.
- Only clients on the same machine can open extension views. A LAN client or a hosted deployment resolves `*.localhost` to itself. Supporting them needs a wildcard domain that resolves to the server, plus a setting for the webview host suffix: today both the API (`webviewHostLabel`) and `pstdio serve` assume `.localhost`. `pstdio serve` says so when it listens beyond loopback.
- The workbench Storybook example still builds its runtime from a `blob:` URL, so it shares the Storybook page's origin. It is example data, not a host.

## Rejected Alternatives

- Keeping opaque origins leaves storage and embedding broken for every extension.
- Adding `allow-same-origin` without a separate origin gives extension code the dashboard's authority.
- A port per extension changes origins on every restart and needs one listener per extension.
- Proxying webview assets through Vite rewrites the Host header that names the extension, and Vite would serve dashboard source on every `*.localhost` host.
