# Typed client contracts in 0.44

Use this reference when the project has the published 0.44 SDK. Keep extension adoption in a
separate PR from SDK changes. Declare the supported extension API range after checking the
published SDK, then typecheck and install the extension against that package.

## Choose the typed method

Create one `WebviewClient` from the view's host. Use these methods when the view declares the
matching capability. A host without a backing service returns a typed unsupported error.

| Operation | Client method | Capability |
| --- | --- | --- |
| Open a page, panel or link | `client.navigation.open(target)` | navigation.open |
| Close the current placement | `client.placement.close()` | placement.close |
| Show a notice | `client.notify.toast(notice)` | notification.show |
| Read or write preferences | `client.preferences.get(name, scope)`, `client.preferences.set(name, value, scope)` | preferences.get, preferences.set |
| Read/write/reset an extension setting | `client.settings.get(key)`, `client.settings.set(key, value)`, `client.settings.delete(key)` | extension.settings.get, extension.settings.set, extension.settings.delete |

Pass `CommandNotice` with type, optional title and message to toast. Forward its metadata
unchanged. Settings set returns the saved value; delete restores the
declared fallback. A reset does not store null. Preference names belong to the caller, except core
preferences.

Use `client.page` for page parameters and `client.files` for supported file operations. The render
context page client and the files list/delete methods are deprecated. Do not add new raw `host.call`
calls when the typed client already owns the operation. Versioned declarations such as
`clipboard.write@1` and `terminal.session` are deprecated; use the current capability name and the
host's terminal composition.

## Read host props and errors

`WebviewHostProps` declares projectId, themePreference, locale, resource, pageLocation, pageParams
and translations. `defineExtensionView` uses this contract when no custom props type is supplied.
Read it through the view's props store. Bind identity to the routed resource and rebind or clean up subscriptions when it changes. A legacy custom props type must be
explicit. Do not use `lastCommand` to refresh data.

Import `isWebviewCapabilityError` from `@pstdio/sdk/extensions` to narrow caught capability errors.
Read `error.code`, `error.message` and `error.data`. The bridge preserves nested data for validation and
permission failures. Display the message while retaining structured details for the operation's
error handling. Do not flatten the error to a message before forwarding it.

## Refresh a command query

Use `useCommandQuery` inside a `QueryClientProvider` from `@tanstack/react-query`.
Pass `refreshOn: { client, events }` to the hook. Include the resource identity in the query
input/key, so a different resource gets a different query. Matching events invalidate the query;
a host-sync reconnect also refreshes it. The hook coalesces invalidations during a pending read,
then performs a fresh read. It removes subscriptions and pending refresh work on unmount or scope
change. Do not add a second subscribe-and-refetch loop around the hook.

Manual subscriptions remain useful for effects that are not command queries. Subscribe before the
initial read, unsubscribe during cleanup, and discard responses from a previous resource. The
resource-reviewer example keeps its manual compatibility hook until its separate adoption PR.

## Preserve command results

Forward the complete command outcome. A rejected command carries code, data, cause, diagnostics
and notices as well as its reason. `getCommandValue` throws `CommandOutcomeError` with the original
outcome. Use the shared stream's iterable chunks, final outcome promise and cancel method. An
early consumer return cancels the command; a disconnect must not rerun it.

## Read resources in pages

Use query for one page and iterate for all matching sessions. Canonical pages contain items and
nextCursor; the last page always has `nextCursor: null`. Pass projectId first in scoped SDK methods,
and use camelCase request fields. Session/workspace contracts are `ExtensionSession` and
`ExtensionWorkspace`; transport details add explicit metadata. Keep opaque extension-owned JSON
unchanged.

For notifications use `setStatus` or `setStatusByKey` with done or dismissed. Use resources for links,
not session/workspace anchor wrappers. Use a named file handle when the published storage API is
available; do not migrate draft files to a guessed storage shape.

The 0.44 release retains old calls and fields. Remove aliases only after every caller adopts the
published replacement and the next breaking release permits removal. Check the
[removal inventory](https://github.com/pufflyai/prompt-studio/blob/main/documentation/references/extensions/0020-api-0-3-removal-inventory.md)
and [release plan](https://github.com/pufflyai/prompt-studio/blob/main/documentation/references/extensions/0024-simplification-release-plan.md)
before changing compatibility behavior.
