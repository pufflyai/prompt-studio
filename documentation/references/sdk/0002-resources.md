# Resource types

`@pstdio/sdk/resources` exports the types for Prompt Studio's core data: projects, workspaces, sessions, skills, agents, files, and settings.

Import them as types:

```ts
import type { Project, Session, SessionStatus, Workspace } from "@pstdio/sdk/resources";
```

These types come from the API contracts. Use the exported types directly, so new
fields and status values reach your code without a separate schema to maintain.
The [resource entry](../../../packages/sdk/src/resources/index.ts) lists every export.

| Data | Public types | Source |
| --- | --- | --- |
| Projects | `Project` | [Project](../../../packages/sdk/src/resources/project.ts) |
| Workspaces | `Workspace`, `WorkspaceListItem` | [Workspace](../../../packages/sdk/src/resources/workspace.ts) |
| Sessions | `Session`, `SessionStatus` | [Session](../../../packages/sdk/src/resources/session.ts) |
| Skills | `Skill`, `SkillFile`, `SkillWithContent` | [Skill](../../../packages/sdk/src/resources/skill.ts) |
| Agents | `AgentInfo`, `AgentAvailabilityType`, `AgentModel`, `AgentSkillsLayout` | [Agent](../../../packages/sdk/src/resources/agent.ts) |
| Files | `FileRecord` | [File](../../../packages/sdk/src/resources/file.ts) |
| Settings | `Settings` | [Settings](../../../packages/sdk/src/resources/settings.ts) |

`harnessLocalId` is the runtime helper exported from this entry. HTTP input and
response types are available from `@pstdio/sdk/api`.

Planner tickets, tags, and statuses belong to the Planner extension. Templates
are extension package contributions. They are not core resource types exported
by this entry.

## Resource references in extensions

Workbench navigation and renderer callbacks use `ResourceRef` from
`@pstdio/sdk/extensions`. It identifies data with `type`, `id`, and optional
presentation and ownership fields. Pass the reference intact between callbacks.

```ts
import { resourceKey, type ResourceRef } from "@pstdio/sdk/extensions";

const document: ResourceRef = {
  type: "document",
  id: "readme",
  extensionId: "acme.notes",
  projectId: "project-1",
  label: "README",
};
const identity = resourceKey(document);
```

`resourceKey` uses extension ID, project ID, type, and ID. Labels and metadata do
not affect identity. URI conversion belongs to host routing and persistence.
See the [composition cookbook](../../guides/extensions/0002-workbench-cookbook.md) for page and panel targets.

## Resource identities

`ctx.resources.allocate({ kind })` assigns a new UUID and the next human shorthand
for a declared resource kind, such as `PS-123`. The extension stores its data under
the returned ID. Keep that ID attached to its shorthand; do not replace it with a
second generated ID.

On `main`, `resources.allocate({ kind, idPrefix: "tk" })` selects `tk_` plus a
22-character Base62 body. This additive option ships in the release after 0.44.0.
It uses the same UUIDv7 generator and compact encoding as `storage.ids.create("tk")`.
Omitting `idPrefix` preserves canonical UUID output. Invalid ID prefixes fail before
allocating a shorthand number. The resource kind's declared uppercase shorthand
prefix and this lowercase ID prefix are separate: `idPrefix` never changes `PS-123`.

On `main`, `resources.allocateMany({ kind, count, idPrefix? })` allocates 1 to 100 IDs
and consecutive shorthands for one kind in a single save and returns them in order.
Later `allocate` calls continue after the batch. Use it when an extension creates many
resources at once, such as an import, and save the resources themselves in
`storage.records.commit` groups. It shares API 0.5.0.

Treat IDs as exact, case-sensitive strings and retain owner fields in references.
An ID prefix is a readable label, not a globally registered resource type. Existing
UUIDs are not rewritten, and existing core extension callers keep UUID output until
their separate adoption change. See [IDs and migration identity](0004-storage.md#ids-positions-and-migration-identity)
for prefix rules and ordering limits.

## Related resources

The shared workbench **Related resources** action lists incoming and outgoing links
for the current resource. **Link resource** searches enabled owner contributions,
lets a person choose a purpose, and calls the same service as `pst resources link`.
Missing or disabled destinations keep their stored reference and remove action.
A link does not grant access to the destination's content.

An owner can declare `resolveMany` on a resource kind. Its command receives
`params.resources` in its second handler argument, a bounded array of references, and returns
`ResourceResolution[]`. Each item contains the current `resource` and an optional
`target` from the public navigation API. Omit missing resources. The workbench
compares the complete owner, project, kind, and ID before using the result.
Resources without a resolvable navigation target show as unavailable.

Use one batch command for several kinds owned by the same extension. The shared
list groups a visible page by command and resolves each group once. The existing
single-resource `resolve` command continues to refresh open resource pages.
Declare the owner data events in the discovery provider's `refreshEvents` so open
lists refresh after edits. Command lifecycle events do not cause another lookup.

Native owner views that show linked resources should include
`viewDataEvents.resourceAnchorsChanged` in `refreshEvents`. The host delivers this
project-scoped dependency after committed link changes, including changes made by
another client or through the CLI.

On `main`, after 0.46.0 (API 0.3.1), extension commands can call
`ctx.resources.resolveMany(references)` with at most 100 references. The host
deduplicates owner-qualified identities and groups each batch by its owner's
`resolveMany` command. Results contain current owner information and qualified
navigation targets. Missing resources, disabled owners, and failed resolvers are
omitted; retain their saved references for unavailable entries. Host workspaces
and sessions resolve through the same API. References stay within the calling
project and resolution does not grant access to personal history on another device.

`ctx.resources.queryAnchorsMany({ resources, direction: "both", limit: 100 })`
reads a single indexed relationship page for up to 100 references. Follow its
nullable `nextCursor` to include every relationship, and deduplicate resource
identities across incoming and outgoing edges before resolving them.

Include `viewDataEvents.resourcesChanged` to refresh labels and availability
after owner discovery data events, extension availability changes, resource
removal, or host workspace/session changes. Use both dependencies for a linked
resource list. Resolve the unique references across visible rows in batches,
instead of making a request for each badge.

## Resource file paths

Resource kind `paths` ship in `@pstdio/sdk` 0.44.0.

Declare `paths` on a resource kind to open its files in the owner's UI. Each entry
contains a workspace-relative `prefix` and a `resolve` command reference. Matching
uses path segments, and the longest matching prefix wins. Paths are normalized
against the conversation workspace before matching, including absolute file links.

```ts
const ticket = defineResourceKind({
  id: "ticket",
  paths: [{ prefix: ".pstdio/extension-storage/my-planner/tickets/", resolve: resolveTicketPath.ref }],
});
```

The command receives `{ path, workspaceId }` as its second argument and returns
`{ resource, target }` using `ResourceResolution`, or `null` for a missing resource.
Only the resource kind's own extension may provide this command. Return a page,
panel, or compound target to choose how the resource opens. Page targets retain
source line and column positions. Unclaimed and missing paths open as workspace
files. Resolution errors appear in the conversation when the link is opened.

Read-only rich messages detect ordinary file paths in prose and show them as resource
bubbles. Agents can share paths without knowing any special link syntax. Owner
resolution supplies the label, icon, and navigation URL. Ordinary web links keep
their normal appearance. Editable messages retain their original Markdown source.

## Resource numbers

On `main` (the release after 0.44.0), core owns numbers for resource kinds that declare a prefix.
Call `ctx.resources.allocate({ kind })` to get an ID and an initial shorthand, including offline.
Store the ID with the extension's data. Read the current shorthand with
`ctx.resources.identity({ kind, id })`; it returns `{ id, kind, shorthand, aliases }`, or
`null` for an unknown resource. Do not store a separate copy of the number.

Use `ctx.resources.identityMany({ kind, ids })` for up to 100 current identities in
one indexed batch. Results follow the input ID order, with `null` for each unknown
ID. The resource kind must belong to the calling extension; reads stay within the
current project. Use batches for the related resources on a selected page.

After devices merge, the resource whose ID sorts first keeps a duplicated number.
Core assigns the others the next free number and retains earlier numbers as aliases.
`ctx.resources.findByShorthand({ kind, shorthand })` returns all matching identities,
with current matches before alias matches. A shared alias can return several resources;
show those choices so the person can select the right one. Both methods are scoped to
the calling extension and project.

`resourceEvents.renumbered` from `@pstdio/sdk/extensions` is the host event
`resource.renumbered`. It carries `{ resource, previousShorthand, shorthand }` after the
number is saved locally. Use it to refresh displayed numbers and generated references.
The host handles collision repair and alias storage; extensions need no sync code.
Workspace numbers (`WS-`) are separate and do not use this API.

### Bounded related history (unreleased API 0.4.2)

Use `ctx.resources.queryRelated({ resources, direction: "both", limit: 100 })`
for one page of distinct related resources from the shared project link index.
At most 100 selected references are accepted. `kind`, `owner`, and `excludeKinds`
filter before pagination. A resource linked in both directions or to several
selected resources occurs once. Resolve only that page with `resolveMany`.

Personal remote history has its own provider. Use
`ctx.workspaces.query({ anchors: [resource], limit: 100 })` to include active
local and signed-in remote workspaces. This matches either link direction and
honors project and owner qualifiers. `anchors: []` matches nothing; omitted
anchors queries the project's active workspaces. Follow `nextCursor` for more.
The HTTP client's `workspaces.query(projectId, input)` accepts the same selection.

Use `ctx.sessions.query({ anchor: resource, includeWorkspaceAnchors: true,
orderBy: "lastActivity", limit: 100 })` for direct session links and sessions in
related active workspaces, deduplicated before pagination. This includes private
remote workspace memberships. Session title `search` is a literal,
case-insensitive substring applied before the limit. Each query defaults to 50
rows and clamps its limit to 1–200. Resource-link pages default to 100 and cap at 100.

*Updated at: 2026-11-14*

## Changed since last seen

A resource kind can opt into a workbench dot by declaring `changes: { heads, read, refreshEvents }`. Supply command references from the owning extension and the events that can advance its position. Its normal `resolveMany` must resolve only resources the current reader may see.

| Contract | What the extension supplies |
| --- | --- |
| `heads` | Accept `params.resources`, a batch of up to 50 references. Return an array of `{ resource, stamp }` for readable resources. Use stored positions so the query can skip opening each document. |
| `read` | Read the content for `ctx.resource`. Return `{ content, stamp }` where the stamp describes precisely that content. |
| `stamp` | A stable `lineage` and an unsigned decimal `revision` (up to 40 digits). Advance it at meaningful commits. Change lineage when a resource is recreated or the meaning of a revision changes. |
| `refreshEvents` | Emit an event with `resourceKeys` or `resourceIds` after a qualifying commit. The host rechecks mounted resources and reconciles on reconnect. |

For example, a publishing extension can use its publication sequence. Editing a draft keeps the same position until the next edition goes live. Sessions uses a completed assistant reply or a request for human input. Renames, queue updates and streamed fragments keep the current position.

To integrate a content viewer, call `await ctx.resources.observeChange?.(resource, stamp)` from the owner command after the authorized read. Return the resulting receipt with the content. A chat renderer returns it in `observedChange`. A webview declares `resources.changes.observed` and calls `host.call("resources.changes.observed", { receipt })` after rendering the content, passing `null` when it clears the content. The host checks focus and resource identity. The receipt carries the observed revision even if a newer revision is already available.

The first observation sets a quiet baseline. Later acknowledgements advance the reader’s position monotonically. Each account owns its baselines in its personal sync space. Signed-out use has a local baseline. Use `client.resourceChanges.query`, `read` and `acknowledge` for programmatic access. A read or a list query alone leaves the baseline untouched.
