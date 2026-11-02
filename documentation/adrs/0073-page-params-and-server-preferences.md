# Page params and server preferences

Proposed: 2026-10-06

Status: Accepted.

## Context

Extension pages need shareable view state. Webview preferences currently drop unknown names in the dashboard. Extensions cannot own the browser URL or persist data from an iframe with an opaque origin.

PS-533 proposed device-local preference storage and immediate enforcement of preference ownership. The maintainer answered review request `ee2823bb-8146-4a3c-9e65-0cc593128dce` on 2026-10-11: use shared server storage that agents can access, and keep existing cross-extension preference access with a deprecation warning until a later breaking release.

## Decision

Pages declare small typed params. URLs use plain query keys, such as `range=now-6h`. Param names start with a lowercase letter and contain lowercase letters, digits, or hyphens. They are at most 64 characters. Existing host selectors are reserved: `resource`, `section`, `document`, `line`, `column`, `endLine`, and `endColumn`. Future host query keys start with `_`.

A page may declare 32 params. The encoded param query may contain 2,048 characters. Invalid programmatic params fail before navigation commits. Invalid URL or saved values fall back to defaults. Defaults are omitted from URLs. Lists use repeated keys. An empty list has no key and reads as the declared default.

Params are view state, not route identity. Layout caches, page state, and breadcrumbs keep using the existing route key. Explicit navigation pushes history when params change. A page owner can patch its params through `page.params.update`, which replaces history. The current location is the single source for webview props and native query context.

Undeclared webview preference names belong to the calling extension. The runtime stores them in `webview_preferences`, keyed by extension identity, name, scope, and scope ID. This is new product data with its own owner, rather than an undeclared setting or hidden extension-storage key. Browser and Desktop views use the same authenticated API that agents can call. The runtime's user scope is shared across its clients; it does not introduce a new user identity system.

The existing theme and locale remain host preferences with their existing persistence and provider behavior. Registered preferences remain accessible across extensions for compatibility. Such access emits a deprecation warning. A later breaking release will enforce ownership for these names together with the other deprecated APIs.

Preference values are limited to 16 KiB, with a total of 256 KiB per extension across scopes. The database checks the total and stores the value in one transaction. Values remain after an extension is removed, so reinstalling the same identity can recover its view choices.

## Alternatives

- Device-local preferences would leave agents unable to use the same data interface. The maintainer chose server storage.
- Params in route identity would create a new layout and tab collection for every filter change.
- One JSON query key would make links harder to read and edit.
- Immediate refusal of cross-extension preferences would break previously accepted calls. The maintainer chose deprecation first.

## Consequences

Links retain filters across reloads, history, and project restoration without creating new layouts. Native page queries rerun when params change. Agents can read and write extension-owned preferences through the same API as webviews.

The host must reserve new URL keys under `_`. Unregistered preference names are isolated immediately, while previously registered names keep their old access behavior until the planned breaking release.
