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
