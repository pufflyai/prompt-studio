# SDK Extensions

`@pstdio/sdk/extensions` contains generic extension authoring primitives. It does not contain workflow-specific contracts.

## Runtime Helpers

- `defineExtension`
- `defineSlot`
- `defineEvent`
- `defineResource`
- `packageAsset`
- `params`

## Core Types

- `ExtensionDefinition`
- `CommandDefinition`
- `CommandRunContext`
- `ResourceRef`
- `SlotDefinition`
- `EventDefinition`
- `ArtifactMountDefinition`
- `TemplateDefinition`
- `SkillDefinition`
- `HarnessProviderDefinition`
- `WorkspaceTypeProviderDefinition`

## Boundary Rule

Use `@pstdio/sdk/extensions` for generic primitives only.

Use owning extension packages for workflow-specific helpers:

| Need | Import From |
| --- | --- |
| Ticket slots/events/resources | `@pstdio/pstdio-ext-planner/contract` |
| Planner ticket-management contracts and helpers | `@pstdio/pstdio-ext-planner/contract` or `@pstdio/pstdio-ext-planner/sdk` |
| Workspace shell slots | `pstdio-ext-workspace-shell/contract` |
| Harness implementation helpers | The owning harness extension package |

The dependency direction is one-way: extensions can import `@pstdio/sdk`, but `@pstdio/sdk` must not import extensions.
