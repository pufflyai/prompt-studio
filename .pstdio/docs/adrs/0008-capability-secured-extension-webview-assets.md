# ADR: Capability-Secured Extension Webview Assets

## Status

Accepted.

## Context

Prompt Studio runs extension webviews in sandboxed iframes without `allow-same-origin`. Their origin is therefore opaque and appears as `Origin: null`. PR #555 tried to authenticate runtime and build assets with a dedicated cookie, but Firefox Total Cookie Protection did not send that cookie for the iframe subresources. The released webviews remained blank.

The runtime bearer token cannot be exposed to guest code, and weakening the sandbox would give extension content more authority than it needs. Webview runtime, module, style, font, and image files are read-only build output, so they need a narrower credential than the normal application session.

## Decision

The API composes a capability-secured webview asset realm before the session-secured application realm.

The extensions feature owns an `ExtensionWebviewAccess` service. It creates one random signing key for the API instance and keeps that key in a closure. The service issues URLs scoped to one installed extension and webview, authorizes only `GET` and `HEAD`, parses the authorized resource, and redacts capability paths. Callers receive service methods and never receive the key.

The `/v1/extensions/webviews/*` route group exclusively owns its namespace. It enforces method and origin policy, verifies the capability, applies opaque-origin CORS, adds `Referrer-Policy: no-referrer`, redacts its logs, and serves the runtime or managed build file. Invalid requests terminate inside that route group.

Normal runtime and application routes continue to require exact-origin cookie authentication or bearer authentication. Their middleware does not inspect extension paths or capabilities.

The iframe remains opaque. Asset authority grants no command, storage, terminal, filesystem, SSE, WebSocket, or bridge authority.

## Consequences

- Webview startup does not depend on ambient cookies or browser cookie partitioning.
- A copied capability can read files only for its signed install and webview until that API instance stops.
- Restarting the API invalidates every prior capability and fresh metadata issues new URLs.
- Capability paths must stay out of logs and referrers because they are bearer credentials.
- Route registration order is security-sensitive and must remain covered by boundary tests.
- Packaged CI must run the opaque iframe and a real bridge interaction in Chromium, strict-cookie Firefox, and WebKit. WebKit is the automated Safari-engine gate; it is not the Safari application binary.

## Rejected Alternatives

- A dedicated webview cookie is not portable across supported browser privacy modes.
- `allow-same-origin` weakens the sandbox.
- Unsigned or enumerable build assets grant broader read authority.
- A global authentication exception couples session security to extension internals and duplicates authorization.
- Persisted keys and capability records add state that the local process lifecycle does not need.
- A service worker or custom webview origin adds infrastructure without improving the current local runtime boundary.
