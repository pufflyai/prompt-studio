# Link icons

The runtime fetches the site icon for a web link in chat, so the dashboard can show it without loading images from other sites.

## Why the runtime fetches icons

Chat shows each web link as a bubble with the linked site's own icon (its favicon). The dashboard cannot load that icon itself:

- The desktop window's content security policy allows images only from its own origin and from `data:` and `blob:` URLs (`img-src 'self' data: blob:`, `connect-src 'self'`). See [window-security.ts](../../../clients/desktop/src/security/window-security.ts).
- The API authenticates with a request header. The dashboard keeps the token in local storage ([browser-session.ts](../../../packages/pstdio-dashboard/src/lib/browser-session.ts)), so an `<img src>` that points at the API has no credentials.

The dashboard asks the runtime through the authenticated API client. The runtime returns the icon as a `data:` URL, which the policy allows. Remote dashboards ask the runtime they are connected to.

## Route

`GET /v1/link-icons?url=<encoded http or https URL>`

The route uses the same authentication as the other `/v1` routes.

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `{ "data_url": "data:image/png;base64,…" }` | The site's icon. |
| 404 | `{ "error": "No icon found." }` | The site has no icon that can be shown, or the URL is not allowed. |
| 400 | Validation error | The `url` query parameter is missing. |

The response schema is `linkIconSchema` in [link-icons.ts](../../../packages/pstdio-api-contracts/src/link-icons.ts). The SDK method is `client.linkIcons.get(url)` in [LinkIconsClient](../../../packages/sdk/src/client/link-icons.ts). It throws a `PstdioApiError` with status 404 when there is no icon.

## How the icon is chosen

1. Read the linked page. Stop after 512 KB or at `</head>`, whichever comes first.
2. Collect `<link>` elements before `<body>` whose `rel` contains `icon` (this includes `shortcut icon`), then those with `apple-touch-icon`. Touch icons come last because they are larger. Resolve each `href` against the final page URL, after redirects. Bun's `HTMLRewriter` parses the page in one pass and skips comments and scripts, so a hostile page cannot stall the runtime.
3. Try at most four declared icons in that order, then `<origin>/favicon.ico`.
4. Use the first response that has status 2xx, an `image/*` content type, and a body of at most 100 KB.

SVG icons are allowed. The dashboard shows icons in an `<img>` element, and an image never runs scripts.

## Network rules

Agent output decides which links appear in chat, so this route must not become a way to reach the local network.

- Only `http:` and `https:` URLs without a user name or password are fetched.
- Before each request, the runtime resolves the host name with `lookup(host, { all: true })` and refuses the request unless every address is public. IP-literal hosts are checked directly.
  - Refused IPv4 ranges: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16` and `224.0.0.0/4`.
  - Refused IPv6 ranges: `fc00::/7`, `fe80::/10`, `fec0::/10`, `ff00::/8` and the local-use NAT64 prefix `64:ff9b:1::/48`.
  - IPv6 forms that carry an IPv4 address follow the IPv4 rule: IPv4-mapped `::ffff:0:0/96`, IPv4-compatible `::/96` (which covers `::` and `::1`), IPv4-translated `::ffff:0:0:0/96`, NAT64 `64:ff9b::/96` and 6to4 `2002::/16`.
- Redirects are followed by hand, at most three per request, and each hop passes the same check.
- Finding one site's icon has a single 3 second limit. It covers DNS lookups, redirects, every icon tried, and reading bodies.
- Requests ask for uncompressed answers (`accept-encoding: identity`), and the runtime does not inflate bodies. A compressed answer is ignored, because Bun inflates a body ahead of the reader and a small compressed body could fill the runtime's memory.
- Requests send no cookies and forward no headers from the dashboard.

The rules live in [public-address.ts](../../../packages/pstdio-api/src/features/link-icons/public-address.ts) and [link-icon-fetcher.ts](../../../packages/pstdio-api/src/features/link-icons/link-icon-fetcher.ts).

## Caching

The runtime keeps results in memory per origin for 30 minutes, including sites without an icon. It keeps at most 200 sites and drops the oldest first. Concurrent requests for one site share one fetch. The dashboard also caches the answer per origin with React Query until the page reloads or the entry is cleaned up. It remembers a failed request as no icon, because messages render often and would otherwise ask again on each render.

Sites usually use one icon, so the first page asked for a site decides the icon for every link to that site.

## Known limits

- **Blocked sites.** Sites that refuse automated requests, such as npmjs.com with HTTP 403, show the globe.
- **DNS rebinding.** The address check resolves the host name, then Bun's `fetch` resolves it again to connect. A DNS server that answers with a public address first and a private address second can pass the check. Closing this gap needs a fetch that connects to the checked address while keeping the host name for TLS. Bun's `fetch` has no option for that.
- **Privacy.** Showing a message makes the runtime contact each linked site. The site sees the runtime's network address. There is no setting to turn icons off.
- **Parallel lookups.** The runtime does not limit how many sites it looks up at once. A browser sends only a few requests at a time to one runtime, so one dashboard asks for a few icons at a time. Those requests share the browser's connections with other API calls for up to 3 seconds each.

## Message UI

`ChatLinkHandler.resolveIcon(href)` in [chat-link.ts](../../../packages/ui/src/components/chat-ui/links/chat-link.ts) returns the icon URL or `null`. When a host provides it, read-only messages show `http:` and `https:` links as bubbles with the icon, and with a globe while the icon loads or when it fails. Hosts without it keep plain links. Links that the host resolves with `resolveHref`, links around images, and mail links stay as they are.

While a message streams, bare links still grow, so their host names are not final. Bubbles show the globe and ask for icons only when the message stops streaming.

Bubbles keep a native `<a href target="_blank" rel="noopener noreferrer">`, so the browser opens the tab and modified clicks work. In the desktop app, the window-open handler opens the link in the system browser. The session chat implements it in [session-link-handler.ts](../../../packages/pstdio-dashboard/src/modules/sessions/chat/session-link-handler.ts). Requirements are in [PRD 0008](../../requirements/platform/0008-resource-path-opening.md).
