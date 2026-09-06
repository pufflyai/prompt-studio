# Resource types

Import product resource types from `@pstdio/sdk/resources`:

```ts
import type { Project, Session, SessionStatus, Workspace } from "@pstdio/sdk/resources";
```

These types come from the API contracts. Use the exported types directly so new
fields and status values reach callers without maintaining a separate schema.
The [resource entry](../../../../packages/sdk/src/resources/index.ts) lists every export.

| Data | Public types | Source |
| --- | --- | --- |
| Projects | `Project`, `Repo` | [Project](../../../../packages/sdk/src/resources/project.ts) |
| Workspaces | `Workspace`, `WorkspaceListItem` | [Workspace](../../../../packages/sdk/src/resources/workspace.ts) |
| Sessions | `Session`, `SessionStatus` | [Session](../../../../packages/sdk/src/resources/session.ts) |
| Skills | `Skill`, `SkillFile`, `SkillWithContent` | [Skill](../../../../packages/sdk/src/resources/skill.ts) |
| Agents | `AgentInfo`, `AgentAvailabilityType`, `AgentModel`, `AgentSkillsLayout` | [Agent](../../../../packages/sdk/src/resources/agent.ts) |
| Files | `FileRecord` | [File](../../../../packages/sdk/src/resources/file.ts) |
| Settings | `Settings` | [Settings](../../../../packages/sdk/src/resources/settings.ts) |

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
See the [composition cookbook](../../extensions/cookbook.md) for page and panel targets.
