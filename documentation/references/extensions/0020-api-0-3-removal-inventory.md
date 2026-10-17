# API 0.3 removal inventory

The 0.44 release introduces these deprecations. They remain callable until the 0.45 breaking
release. Do not remove an item until its deprecation has shipped in a stable SDK. See
[API versioning](0014-api-versioning.md). Other PS-807 and PS-806 additions extend this inventory
in their owning PRs.

| Deprecated surface | Replacement | Last maintained caller | Data conversion | Removal |
| --- | --- | --- | --- | --- |
| `/extensions` capability constants (`WEBVIEW_*`, `ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES`) | Hosts import from `pstdio-api-contracts`; authors use the typed webview client | Host imports migrated in PS-806 N | None | 0.45 |
| `/extensions` `EXTENSION_EVENTS_SCOPE`, `resolveEventReferenceId`, `artifactMountId` | Host contract exports | Host imports migrated in PS-806 N | None | 0.45 |
| `/extensions` `qualifyNavigationTarget`, page params and URL helpers, `defaultPageResourceCodec`, URL helper types, `resolveDataTable*`, `mergeOrderedHistory` | Host contract exports | Host imports migrated in PS-806 N | None | 0.45 |
| `/extensions` and `/client` `AssetReference`, `AssetTransfer` aliases | `/resources` | Existing external consumers may remain; in-repo code can import the canonical type | None | 0.45 |
| `/extensions` and `/api` notification type aliases | `/resources` | Existing external consumers may remain; command and client result types stay compatible | None | 0.45 |
| `/hooks` entry | Typed extension hooks and the regular SDK client | No extension caller | None | 0.45 |
| `/client` workspace/session `listActivity` | Their GET activity HTTP endpoints; use session queries for session history | None in repository source | None; HTTP paths stay available | 0.45 |
| `/client` sessions `getConversationSources` | GET session conversation sources HTTP endpoint | None in repository source | None; HTTP path stays available | 0.45 |
| `/client` skills `updatePreferences` | PUT project skill HTTP endpoint | None in repository source | None; HTTP path stays available | 0.45 |

`host.dispatchKeyboardEvent` is private guest plumbing, outside the public capability union.
Keyboard forwarding continues through the private runtime path and requires no declaration.

The API report covers the eight public SDK subpaths from `api-report-entries.json`. `/hooks`
is host-only and deprecated. Export aliases keep their existing type and runtime behavior for the
window above. The 0.45 removal must inspect both SDK exports and real HTTP/bridge registrations.
