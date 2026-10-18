# PRD: Align extension API shapes

Status: Proposed. Created: 2026-10-17. This PRD plans changes; it does not implement them.
It uses the release plan of [Simplify extension APIs](0011-simplify-extension-apis.md#delivery-and-acceptance):
0.44 adds the new APIs and deprecates the old ones, and 0.45 removes them.

## Purpose and scope

An audit of the extension context, webview bridge, manifest and SDK found cleanups that the
[storage PRD](0009-standardize-storage-api.md) and [0011](0011-simplify-extension-apis.md) do not
cover. Most are the same idea written several ways, or public APIs nobody calls.

Each theme below names the current API, the evidence, the change and its level under
[API versioning](../../references/extensions/0014-api-versioning.md). Unless a theme says otherwise,
the new API and the deprecations are additive in 0.44, and the removal is breaking in 0.45. An item
not deprecated in a stable 0.44 moves to the next breaking release.

Caller counts cover `extensions/`, `.pstdio/extensions/`, `packages/` and `clients/`, without tests,
`dist` and the API report. Host bugs found in the audit are fixed in ticket PS-805, not here.
Paths below are relative to [`types/`](../../../packages/pstdio-api-contracts/src/extension-kernel/types)
unless they are linked.

## A. One webview host capability factory

The workbench, dashboard and testbench use one
`createExtensionWebviewHostCapabilities(adapters)`.
It owns every capability name, parameter checks, result wrappers, and frame stream lifetime.
Hosts supply typed service adapters. They cannot replace capability handlers.

Workbench adapters bind navigation, placement, preferences and native commands. The extension
command adapter adds project, slot and resource ownership. Dashboard adapters bind API services
for settings, streams, notifications, files and artifacts. The testbench supplies its command
service, in-memory files and scripted terminal through the same workbench registration path.

Every host exposes the same capability names. A missing service produces
`WebviewHostCapabilityError` with `code: "unsupported"` and `data.capability`. Invalid input
produces `code: "invalid_params"` before invoking a service. Command execution preserves the
complete outcome, including rejections. Stream cancellation, disconnect behavior, and the
existing 16-stream and 8 MiB unread-data limits have one owner in the factory.

[Host adapter reference](../../references/workbench/0005-webview-hosts.md).

Change level: none for extensions. This is internal to the hosts. Theme B adds guest error
transport and typed client methods separately.

## B. Typed webview client

[`WebviewClient`](../../../packages/sdk/src/extensions/webview-client.ts) wraps only `artifacts`,
`commands`, `streams`, `events` and `settings`. Extensions call the rest through raw `host.call`:
`navigation.open` 7 times, `notification.show` 3, `preferences.get`/`set` 2 and `placement.close` 1.

Add `client.navigation.open(target)`, `client.placement.close()`, `client.notify.toast(notice)` and
`client.preferences.get`/`set`. Fold the render-context page and files clients in
[`define-extension-view.ts`](../../../packages/sdk/src/extensions/define-extension-view.ts) into
the one `WebviewClient`.

Host props are typed `unknown`. The dashboard sends eight props, the workbench two and the testbench
five. Add `WebviewHostProps` to the contracts with `projectId`, `themePreference`, `locale`,
`resource`, `pageLocation`, `pageParams` and `translations`. Deprecate `lastCommand`; extension-lab
and motion-lab use it to trigger refreshes. The replacement is `client.events.subscribe`.

Other shape fixes:

- Bridge errors reach the guest as `new Error(message)`; gate denial codes go only to diagnostics
  ([capability gate](../../../packages/pstdio-extensions/src/bridge/contract/capabilities.ts)).
  Capability errors carry `{ code, message, data? }`.
- `WebviewNotificationShowParams` is `{ level, title, message? }`, while `CommandNotice` is
  `{ type, title?, message }`. `notification.show` accepts `CommandNotice`; deprecate the old shape.
- `extension.settings.set` returns nothing; `preferences.set` returns the saved value. Make
  `settings.set` return the saved value too.
- [`useCommandQuery`](../../../packages/sdk/src/extensions/react/index.ts) has no refresh option.
  Seven extensions, one of them a skill example, write their own subscribe-and-refetch loop. Add
  `refreshOn: { client, events }`.

Deprecate APIs with no extension callers: the `terminal.session` capability and
[`createTerminalSessionBridge`](../../../packages/sdk/src/extensions/terminal-session-bridge.ts),
the render-context page client, and `files.list`/`files.delete` (only the internal workbench lab
fixture calls them). No extension declares a versioned capability such as `"clipboard.write@1"`;
only host tests use the form. Deprecate it.

Change level: additive in 0.44. Removing the old shapes and refusing versioned declarations is
breaking in 0.45.

## C. Context shape

[`CommandContext.invocation`](../../../packages/pstdio-api-contracts/src/extension-kernel/types/context.ts)
repeats the top-level `source`, `attachment` and `slot`; only its `metadata` is new. No extension
reads it. Move `metadata` to the top level and deprecate `invocation`.

The base context declares `source`, but only command contexts set it. Declare `source` on
`CommandContext` and deprecate it on the base. Deprecate `project`; no extension reads it.

Only `CommandContext` has `signal`. Workspace providers get theirs from
`WorkspaceProviderCreateInput.signal` (`extension.ts`). Add `signal` to `ExtensionContextBase` and
deprecate the input field.

`ctx.notify.toast` is a silent no-op outside commands. Only the command runner
([environment](../../../packages/pstdio-extensions/src/runtime/runner/environment.ts)) collects
notices. Add `CommandContext.notices.add(notice)` and deprecate `toast`.

`SetupContext` and `MigrationContext` are unused aliases. No extension reads `EventContext.eventId`
or `deliveryId`. Deprecate all four. `skills` is optional, but the production host always sets it.
Make it required; the testbench must then provide it.

Change level: additive in 0.44, breaking in 0.45.

## D. Services with no callers

No extension calls these context services. Packages outside the host wiring do not call them either:

| Service | Definition |
| --- | --- |
| `ctx.terminal` | `context.ts` |
| `ctx.net.findFreePort` | `context.ts` |
| `ctx.connections.stream` | `connections.ts` |
| `ctx.activity.record` | `context.ts` |
| `ctx.automation.get`, `cancel` | `automation.ts` |
| `getQueuedFollowUps`, `updateQueuedFollowUp`, `combineQueuedFollowUps`, `steerQueuedFollowUp` | `sessions.ts` |
| `ctx.views.reorder` | `saved-views.ts` |

The CLI uses HTTP client methods with the queued-input names; those stay. 0011 used to keep
`terminal`, `net`, `activity` and queued input. Deprecate them in 0.44 unless a supported caller
appears before the contracts freeze. `ctx.resources.removeAnchors` also has no callers, but it
replaces the session and workspace wrappers that 0011 deprecates, so it stays.

Change level: additive in 0.44, breaking in 0.45.

## E. Naming and lookups

`ctx.views.remove` (`saved-views.ts`) returns `{ deleted }`; every other API deletes with `delete`.
Add `views.delete` with the same result and deprecate `remove`. It has one Planner caller.

Lookups by ID return `null` when the record is missing, as `workspaces.get` and `sessions.get` do.
`automation.get` returns `undefined`; D deprecates it, so leave it. New lookups follow the rule.

`workspaces.get(id)` and `workspaces.getByShorthand(shorthand)` both return a workspace. Make
`get` accept either, with an ID match first, and deprecate `getByShorthand`. Reports and Planner
call it.

If a supported caller keeps the queued-input methods (see D), give them one object input, like
`create` and `followup`, instead of `(sessionId, queuePosition, input)`.

`automation.enqueue` accepts a `CommandRef`, but
[`AutomationRun.commandId`](../../../packages/pstdio-api-contracts/src/automation.ts) is a string
the host builds as `<extension>.command.<id>`. Add `command: CommandRef` and deprecate `commandId`.

`process.run` and `process.runOrThrow` both exist. Document that `run` is for callers that inspect
the exit code and `runOrThrow` for callers that treat a non-zero exit as an error.

Change level: additive in 0.44, breaking in 0.45. The process note is documentation only.

## F. Resource and client conventions

The SDK client and HTTP contracts mix conventions:

- Casing: [activity](../../../packages/pstdio-api-contracts/src/activity.ts), sessions, workspaces,
  [skills](../../../packages/pstdio-api-contracts/src/skills.ts) and filesystem inputs use
  snake_case. Notifications, automation and command execution use camelCase.
- Lists: notifications, resource links and session pages return `{ items, nextCursor }` with three
  different null rules. Activity returns `{ events, next_cursor }`. Projects, workspaces, skills,
  sessions and saved views return unpaged arrays.
- Project scope: `workspaces.list(projectId)` takes it first, `notifications.create({ projectId })`
  and `workspaces.create({ project_id })` take it in the input.
- The project query parameter is `project_id` for workspaces and sessions, `projectId` for auth
  tokens and `project` for agent info.

Use camelCase JSON, `{ items, nextCursor: string | null }` for paged lists, `projectId` as the first
SDK argument and `projectId` as the query parameter. 0011 defines the session and workspace types.
Page every named dynamic catalog, following 0011's final decision without a small-catalog exemption.

Change level: the SDK client is not in the extension API report today (see N). It follows the same
deprecate-then-remove rule. Granite calls `createClient` and `client.projects` from outside this
repository, so `/client` changes break scripts.

## G. Actions and when conditions

`KanbanRendererRowAction`, `DataTableRendererRowAction` and `DataTableRendererSelectionAction`
(`kanban-renderer.ts`, `data-table-renderer.ts`) have the same fields. The wire format already
uses one schema. Add `CollectionAction { id, label, icon?, destructive?, command }` and keep the
three names as deprecated aliases.

`ActivityItemContribution` (`contributions.ts`) uses `command` and `params`, while navigation
items, tab menu rows and keybindings use `action: NavigationTarget`. Use `action` with `title` as
the label, and deprecate `command` and `params`.

Menus, keybindings and navigation items take a `WhenExpression` object. `ViewToolbarAction.when`
(`view-toolbar-action.ts`) and `TreeAction.when` (`tree-renderer.ts`) take a string. Accept
`WhenExpression` in both and deprecate the string form.

Change level: additive in 0.44, breaking in 0.45.

## H. Form schemas

Four schema dialects describe form fields: `ParamDescriptor` (`params.ts`), `ControlParam`
(`control-declarations.ts`), `ExtensionSettingProperty` (`contributions.ts`) and
`PageParamDefinition` (`pages.ts`). They spell labels, defaults and types differently.

`KanbanRendererCreateRowContribution` declares its own `params` next to the command it calls.
Planner shows the cost. Its [form](../../../extensions/pstdio-planner/src/ticket-create-form.ts)
makes `content` required markdown and adds `files`. The
[command](../../../extensions/pstdio-planner/src/commands/create-ticket.ts) takes optional long text
and has no `files` parameter. The dialog strips the files and attaches them with a second command.
The command's own `attachments` parameter is never filled.

`createRow` reuses the command's params, with `fields?: string[]` to choose which to show. The host
owns the dialog's cancel, error and file-removal labels; deprecate `createRow.labels` and
`createRow.params`. New form APIs use `ParamDescriptor`.

Change level: additive in 0.44, breaking in 0.45.

## I. Collection renderer base

`RendererContributionBase` (`renderer-base.ts`) already shares `title`, `icon` and empty-state
text. Kanban and data-table renderers still repeat `toolbarActions`, `query`, `rowActions`,
`onRowActivate`, default settings, filter, sorts and views. Kanban calls its fields `attributes`;
the table calls them `columns`. Add `CollectionRendererBase` and a shared `CollectionField` type.

The tree renderer's `filter` is a text search string. Rename it to `search`.

The base requires `title`, and `NativeViewBody` (`views.ts`) then omits it so `ViewContribution`
can add it back. Split the base into a body type without `title` and a registration type with it.

`KanbanRendererResourceRef`, `DataTableRendererResourceRef`, `TreeRendererResourceRef`,
`FileRendererResourceRef` and `ControlsResourceRef` are all `ResourceRef`. Deprecate the aliases.

Change level: additive in 0.44, breaking in 0.45.

## J. Slots

The [metadata adapter](../../../packages/pstdio-workbench/src/extensions/host/workbench-extension-metadata-adapter.ts)
places settings panels by checking whether the slot ID contains `"global"`, and status bar items by
checking whether it ends with `"leading"`. No built-in settings slot ID contains `"global"`. Add
`SettingsPanelContribution.target: "global" | "project"` and `StatusBarItemContribution.side:
"leading" | "trailing"`, and stop reading placement from slot IDs.

ID matching already fails once. The dashboard
[wrapper](../../../packages/pstdio-dashboard/src/shared/extensions/extension-webview-capabilities.ts)
gives settings panels file capabilities only for slot `project.settingsPanels`. Planner's panel uses
`project.settings`, so it never matches. That bug belongs in PS-805.

`UiSlotKind` (`slots.ts`) has six values; the host checks only `menu`. `panel` and `settings` come
only from kernel slots with no users: `projectSlots.sidenav`, `projectSlots.settingsPanels`,
`workspaceSlots.sidenav` and `sessionSlots`. Deprecate those slots and the two kinds.

Change level: additive in 0.44, breaking in 0.45.

## K. Events

[Event names](../../../packages/pstdio-api-contracts/src/extension-kernel/kernel-slots.ts) mix
styles: `session.awaitingInput` is camelCase, `view.board-views.changed` is kebab-case, and
`workspace.provision` is a noun. Use `noun.past-tense` names in kebab-case. Keep old names as
deprecated aliases.

`workspace.provision` is awaited and gates readiness
([coordinator](../../../packages/pstdio-api/src/features/workspaces/provision-coordinator.ts)). It
is a hook, not an event. Add a provider hook and deprecate the event.

Payloads disagree. Workspace events have no `projectId`; the others do. Session payloads repeat
`workspaceId`, `branch` and `workspaceDir` next to `workspace`, and
[session hooks](../../../packages/pstdio-api/src/features/hooks/session-hooks.ts) can make
`workspaceDir` and `workspace.root_path` disagree. `session.started` and `session.completed` add
`anchors` again and merge workspace anchors without removing duplicates. Use a fixed envelope
`{ projectId, workspace? }` with a typed body. Drop `anchors`; links come from `resources`.

Some events have no producer: `project.opened` (3 Planner consumers), `workspace.created`,
`workspace.deleted`, `git.committed`, `git.rebased`, `git.conflicted` and
`view.repositories.changed`. PS-805 emits the used ones. Deprecate the rest unless a producer ships.

Change level: additive in 0.44, breaking in 0.45.

## L. Unused contracts

Nothing reads `ResourceHierarchyProvider.parent` (`composition.ts`); the dashboard reads parents
from resource metadata. Nothing reads `MenuContribution.disabledWhen` or `disabledReason`.
`TreeRendererActionParams` and `TreeRendererCommandResult` have no references. Deprecate all four.

Change level: additive in 0.44, breaking in 0.45.

## M. Author repetition

`PageContribution` (`pages.ts`) requires `title` and `slots`. Font Editor writes "Icon Set editor"
on its view, page and navigation item, and ten extension files declare `slots: []`. Default a page
title and icon to its main view's, and a navigation item's label and icon to its page's. Make
`slots` optional.

The public `PackageManifest` (`extension.ts`) lacks `pstdio.projectFiles.tracked`, which the
[runtime manifest](../../../packages/pstdio-extensions/src/runtime/package-manifest.ts) validates.
Keep one type.

Resource kinds are `resourceKind: ResourceKindRef`, `resourceKind?: string`,
`resourceType: ResourceKindRef[]`, `resourceType: string` or `kinds`. Accept `ResourceKindRef`
everywhere under the name `resourceKind`.

Do not merge IDs that are separate on purpose, such as a widget `id` and its `rendererId`.

Change level: additive. Only renamed fields need a 0.45 removal.

## N. SDK public surface

The SDK exports `/extensions`, `/extensions/react`, `/testing`, `/data`, `/prompts`, `/hooks`,
`/client`, `/api` and `/resources`. No extension imports `/client`, `/api`, `/resources` or
`/hooks`. In-repo hosts import `/api` in about 155 files, including the published
`@pstdio/workbench` and `@pstdio/ui`. Granite imports `/client`. In 0.44, list the public subpaths
in 0014 and decide, per subpath, between "public, in the API report" and "host-only, deprecated".

[`/extensions`](../../../packages/sdk/src/extensions/index.ts) exports host-only values with no
extension callers: `WEBVIEW_*` constants, `ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES`,
`EXTENSION_EVENTS_SCOPE`, `resolveEventReferenceId`, `qualifyNavigationTarget`, page-param helpers,
`parseWorkbenchPageUrl`, `serializeWorkbenchPageUrl` and `resolveDataTable*`. `mergeOrderedHistory`
and `artifactMountId` are used only inside their packages. `host.dispatchKeyboardEvent` is in the
public capability union, although no extension may call it. Hosts import these from
`pstdio-api-contracts` directly; deprecate the SDK exports.

The dashboard builds about 75 raw `/v1` paths in 34 files through the untyped request helper in
[`api.ts`](../../../packages/pstdio-dashboard/src/lib/api.ts), and calls `createClient` twice. Route
it through the typed client, then delete client methods that still have no callers.

Some names have two meanings or two homes. `TerminalSessionAdapter` is one type in
[`/api`](../../../packages/pstdio-api-contracts/src/extensions.terminal.ts) and a different one in
`/extensions`. B removes the second; if it stays, rename it `ExtensionTerminalSession`.
`AssetReference` and `AssetTransfer` come from `/client` and `/extensions`. Notification types
come from `/api` and `/extensions`. Give each type one export path.

Change level: deprecations are additive in 0.44. Removing exports is breaking in 0.45.

### Public-surface decision for 0.44

`/extensions`, `/extensions/react`, `/testing`, `/data`, `/prompts`, `/client`, `/api` and
`/resources` are public and reported. `/hooks` is host-only and deprecated. External scripts and
published host packages are supported consumers too. `/resources` is the canonical path for asset
and notification types; old export paths stay as deprecated aliases. See the complete policy in
[API versioning](../../references/extensions/0014-api-versioning.md#public-sdk-subpaths).

The dashboard uses typed SDK methods for JSON requests. Methods with no repository caller must
still be deprecated before removal because `/client` is public. They cannot be deleted during
the 0.44 adoption step. The 0.45 removal inventory owns their final removal.

## Delivery and acceptance

Follow the shared [release gates and acceptance checks](../../references/extensions/0025-shape-alignment-acceptance.md).

## Not in scope

- Records, assets and file roots: [0009](0009-standardize-storage-api.md).
- Notifications, session queries and types, resource links, command outcomes, saved views and
  workspace deletion: [0011](0011-simplify-extension-apis.md).
- Host bugs, capability drift, event producers and APIs deprecated in 0.43.1: ticket PS-805.
