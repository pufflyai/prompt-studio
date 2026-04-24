---
layout: ../../../layouts/docs-layout.astro
title: Types
description: Resource, API, plugin, and hook types exposed by the SDK.
htmlTitle: SDK types
htmlDescription: Resource, API, plugin, and hook TypeScript types exposed by the @pstdio/sdk package.
section: References
category: Types
categoryOrder: 4
order: 1
---

## Where types live

The SDK exposes types through four subpath exports:

- **`@pstdio/sdk/resources`** — resource shapes (`Project`, `Ticket`, `Session`, …).
- **`@pstdio/sdk/api`** — API request and response input/output types.
- **`@pstdio/sdk/plugins`** — plugin definitions, action shapes, schedule types.
- **`@pstdio/sdk/hooks`** — hook context types.

The source of truth for the wire format is the shared `pstdio-api-contracts` package; the SDK re-exports from there.

## Resources

Exported from `@pstdio/sdk/resources`:

- **`Project`** — `id`, `name`, `shorthand`, `selected_agents`, timestamps.
- **`Repo`** — `id`, `project_id`, `path`, `default_branch`.
- **`Ticket`** — base ticket record.
- **`TicketDetail`** — `Ticket` plus related tags, files, and content.
- **`TicketListItem`** — the shape returned by list endpoints (trimmed for lists).
- **`TicketFile`** — `id`, `name`, `mime_type`, `size`, `created_at`.
- **`Workspace`** — full workspace record with `worktree_path`, `branch`, `base`.
- **`WorkspaceListItem`** — list variant.
- **`Session`** — full session record.
- **`SessionStatus`** — `in_progress | awaiting_input | completed | failed | cancelled | disconnected`.
- **`Status`** — ticket status definition.
- **`AttemptStatus`** — attempt status definition.
- **`Tag`** — tag definition.
- **`TagOption`** — an option under a tag.
- **`Template`** — template metadata.
- **`TemplateType`** — `prompt | ticket | document`.
- **`TemplateWithContent`** — `Template` plus `content`.
- **`Skill`** — skill metadata.
- **`SkillFile`** — a file within a skill directory.
- **`SkillWithContent`** — `Skill` plus `content`.
- **`AgentConfig`** — stored agent configuration.
- **`AgentInfo`** — rich agent availability with installed flags.
- **`AgentModel`** — `id`, `label`, capability flags.
- **`FileRecord`** — a generic file envelope used by several endpoints.

## API input/response types

Exported from `@pstdio/sdk/api`. Common ones:

- **`CreateProjectInput`**, **`RegisterRepoInput`**.
- **`CreateTicketInput`**, **`UpdateTicketInput`**, **`ListTicketsInput`**, **`UploadTicketFileInput`**.
- **`CreateTicketAttemptInput`**, **`TicketAttemptResponse`**.
- **`UpdateWhenAttemptStatusInput`**, **`UpdateWhenAttemptStatusResponse`**.
- **`CreateWorkspaceInput`**, **`UpdateAttemptStatusInput`**, **`UpdateAttemptStatusResponse`**, **`RemoveWorktreeResponse`**.
- **`CreateSessionInput`**, **`FollowUpInput`**, **`ApprovalInput`**, **`ResolveSessionIdInput`**, **`ResolveSessionIdResponse`**, **`SessionConversationResponse`**.
- **`CreateStatusInput`**, **`CreateAttemptStatusInput`**.
- **`CreateTagInput`**, **`UpdateTagInput`**, **`CreateTagOptionInput`**, **`UpdateTagOptionInput`**.
- **`CreateTemplateInput`**, **`UpdateTemplateInput`**.
- **`SetupAgentInput`**, **`SetupAvailableAgentsInput`**, **`UpdateAgentInput`**.
- **`ExecuteActionInput`**, **`ActionResult`**, **`ActionDescriptor`**.

## Plugin types

Exported from `@pstdio/sdk/plugins`:

- **`PluginDefinition`** — the object you pass to `definePlugin`.
- **`PluginHooks`** — keyed map of hook-name → handler.
- **`ActionInput`** — an action as it appears on the plugin.
- **`ActionParamDef`**, **`TextActionParam`**, **`LongTextActionParam`**, **`SelectActionParam`**, **`TemplateSelectActionParam`**, **`AgentActionParam`**, **`RepoActionParam`**.
- **`ActionTrigger`**, **`ActionTriggerContext`**, **`ActionTriggerResult`**.
- **`ScheduleDefinition`**, **`ScheduledTriggerContext`**.
- **`PluginHelperContext`** — the context passed to every helper.

## Hook context types

Exported from `@pstdio/sdk/hooks`:

- `TicketContext`, `TicketCreationContext`, `TicketStatusChangeContext`.
- `SessionHookContext`.
- `WorktreeCreateContext`, `WorktreeContext`, `WorktreeRemoveContext`.
- `CommitContext`, `RebaseContext`, `MergeContext`, `ConflictContext`.
- `AttemptStatusChangeContext`.
- `HookClient` — the scoped SDK client handed to every hook.

See [Hook reference](/docs/reference/sdk/hooks/) for the fields on each.

## Client error

```ts
import { PstdioApiError } from "@pstdio/sdk/client";

class PstdioApiError extends Error {
  status: number;
}
```
