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
