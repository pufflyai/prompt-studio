# SDK Method Reference

This page lists the current runtime APIs and key public types exported by `@pstdio/sdk` and its public subpaths.

`@pstdio/sdk/api`, `@pstdio/sdk/resources`, and `@pstdio/sdk/hooks` are type-only entrypoints. They do not export runtime methods.

## `@pstdio/sdk`

The root export is a curated convenience surface.

### `createClient(options?: ClientOptions)`

Re-export of the main SDK client factory from `@pstdio/sdk/client`.

### `new PstdioApiError(message: string, status: number)`

Re-export of the SDK HTTP error class from `@pstdio/sdk/client`.

### Root Notes

- Shared API, resource, and hook types are also available from the root entrypoint.
- `definePlugin(...)`, plugin runtime helpers, `renderPrompt(...)`, `createRequest(...)`, `RequestFn`, and `ActionTargetMap` are not exported from the root. Import them from their dedicated subpaths.

## `@pstdio/sdk/client`

### `createClient(options?: ClientOptions)`

Creates a fully wired `PstdioClient` with `projects`, `tickets`, `workspaces`, `sessions`, `statuses`, `tags`, `templates`, `skills`, `agents`, and `actions`.

### `createRequest(options: ClientOptions)`

Creates the low-level request function used by the domain clients.

### `new PstdioApiError(message: string, status: number)`

Thrown by request helpers and client methods when the API responds with a non-2xx status.

### Key Types

- `type ClientOptions`
- `type PstdioClient`
- `type RequestFn`

### `client.projects.list()`

Lists all projects visible to the current client.

### `client.projects.get(projectId: string)`

Fetches a single project by id.

### `client.projects.create(input: CreateProjectInput)`

Creates a project.

### `client.projects.delete(projectId: string)`

Deletes a project.

### `client.tickets.list(projectId: string, input?: ListTicketsInput)`

Lists tickets for a project, with optional filters such as status, tags, archive state, draft state, parent, shorthand, and search text.

### `client.tickets.get(ticketId: string)`

Fetches a ticket detail record, including `content`.

### `client.tickets.create(input: CreateTicketInput)`

Creates a ticket.

### `client.tickets.update(ticketId: string, input: UpdateTicketInput)`

Updates a ticket.

### `client.tickets.delete(ticketId: string)`

Deletes a ticket.

### `client.tickets.createAttempt(ticketId: string, input: CreateTicketAttemptInput)`

Creates an attempt for a ticket and may also start a session depending on the input.

### `client.tickets.updateWhenAttemptStatus(ticketId: string, input: UpdateWhenAttemptStatusInput)`

Updates the ticket status only when all attempts match the requested attempt status.

### `client.tickets.listFiles(ticketId: string)`

Lists files attached to a ticket.

### `client.tickets.getFileContent(ticketId: string, fileId: string)`

Downloads ticket file content as `Uint8Array`.

### `client.tickets.uploadFile(ticketId: string, input: UploadTicketFileInput)`

Uploads a file attachment to a ticket.

### `client.workspaces.list(projectId: string)`

Lists workspaces for a project.

### `client.workspaces.get(workspaceId: string)`

Fetches a single workspace by id.

### `client.workspaces.create(input: CreateWorkspaceInput)`

Creates a workspace record.

### `client.workspaces.updateAttemptStatus(workspaceId: string, input: UpdateAttemptStatusInput)`

Updates the attempt status for a workspace.

### `client.workspaces.removeWorktree(workspaceId: string)`

Removes the underlying worktree for a workspace and returns whether a worktree was removed.

### `client.workspaces.delete(workspaceId: string)`

Deletes a workspace.

### `client.sessions.list(projectId: string)`

Lists sessions for a project.

### `client.sessions.get(sessionId: string)`

Fetches a single session by id.

### `client.sessions.create(input: CreateSessionInput)`

Creates a session.

### `client.sessions.archive(sessionId: string)`

Archives a session.

### `client.sessions.followUp(sessionId: string, input: FollowUpInput)`

Sends a follow-up request to an existing session.

### `client.sessions.approve(sessionId: string, input: ApprovalInput)`

Approves or denies an approval request for a session.

### `client.sessions.getConversation(sessionId: string)`

Fetches the stored session conversation payload.

### `client.statuses.list(projectId: string)`

Lists ticket statuses for a project.

### `client.statuses.create(projectId: string, input: CreateStatusInput)`

Creates a ticket status for a project.

### `client.statuses.delete(projectId: string, statusId: string)`

Deletes a ticket status from a project.

### `client.tags.list(projectId: string)`

Lists ticket tags for a project.

### `client.tags.create(projectId: string, input: CreateTagInput)`

Creates a ticket tag definition.

### `client.tags.update(projectId: string, tagId: string, input: UpdateTagInput)`

Updates a ticket tag definition.

### `client.tags.delete(projectId: string, tagId: string)`

Deletes a ticket tag definition.

### `client.tags.createOption(projectId: string, tagId: string, input: CreateTagOptionInput)`

Creates an option for a tag.

### `client.tags.updateOption(projectId: string, tagId: string, optionId: string, input: UpdateTagOptionInput)`

Updates a tag option.

### `client.tags.deleteOption(projectId: string, tagId: string, optionId: string)`

Deletes a tag option.

### `client.templates.list(projectId: string)`

Lists templates for a project.

### `client.templates.get(projectId: string, templateId: string)`

Fetches a template together with its content.

### `client.templates.create(projectId: string, input: CreateTemplateInput)`

Creates a template.

### `client.templates.update(projectId: string, templateId: string, input: UpdateTemplateInput)`

Updates a template.

### `client.templates.delete(projectId: string, templateId: string)`

Deletes a template.

### `client.skills.list(projectId: string)`

Lists skills installed for a project.

### `client.skills.get(projectId: string, skillId: string)`

Fetches a skill together with its content and installation metadata.

### `client.agents.list()`

Lists configured agents.

### `client.agents.info()`

Lists known agent definitions and their availability.

### `client.agents.setup(input: SetupAgentInput)`

Creates initial configuration for an agent.

### `client.agents.update(agentId: string, input: UpdateAgentInput)`

Updates an agent configuration.

### `client.agents.delete(agentId: string)`

Deletes an agent configuration.

### `client.actions.list(projectId: string, targetType?: TargetType)`

Lists registered UI actions for a project, optionally filtered to a target type.

### `client.actions.execute(projectId: string, actionKey: string, input: ExecuteActionInput)`

Executes a registered action for the provided target within a project.

## `@pstdio/sdk/plugins`

`@pstdio/sdk/plugins` includes everything needed for project-local plugins.

### `definePlugin(plugin: PluginDefinition)`

Validates a plugin definition and returns it unchanged.

### Key Types

- `type ActionDefinition`
- `type ActionDescriptor`
- `type ActionPlacement`
- `type ActionTargetMap`
- `type ActionTriggerContext`
- `type HookResponse`
- `type PluginDefinition`
- `type PluginHooks`
- `type PostHookReturn`
- `type PreHookReturn`
- `type PullTicketsInput`
- `type PullTicketsResult`
- `type TargetType`

### Helper Context Contract

All runtime helpers that accept `ctx` only depend on:

```ts
{
  client: PstdioClient;
  projectId: string;
}
```

You pass the full `ctx` object as the first parameter, but the helper itself only requires `ctx.client` and `ctx.projectId`.

When `ctx` already carries the matching rich ticket or workspace object, helpers reuse that object before falling back to project-wide list lookups.

`runCommand(...)` is the exception because it does not take `ctx`.

### `createAttempt(ctx, input)`

Resolves `input.ticketId` by id or shorthand, creates a ticket attempt, and forces `start_session: true`. Returns `null` when the ticket cannot be resolved.

### `createSession(ctx, input)`

Creates a session and fills `project_id` from `ctx.projectId`.

### `followupSession(ctx, { sessionId?, ...input })`

Sends a follow-up to an existing session. Uses the explicit `sessionId` when provided, otherwise falls back to a session action target, `ctx.originalSessionId`, or `ctx.sessionId`.

### `createWorkspace(ctx, input)`

Resolves `input.ticketId` by id or shorthand, creates a workspace-only attempt, and forces `start_session: false`. Returns `null` when the ticket cannot be resolved.

### `findTicketByRef(ctx, { ticketId? })`

Looks up a ticket by id or shorthand within the current project. Reuses `ctx.ticket` or a ticket action target when one already matches.

### `findWorkspaceByRef(ctx, { workspaceId? })`

Looks up a workspace by id or workspace shorthand within the current project. Reuses `ctx.workspace` or a workspace action target when one already matches.

### `workspacesForTicket(ctx, { ticketId? })`

Lists workspaces whose `ticket_shorthand` matches the resolved ticket.

### `getAttemptsForTicket(ctx, { ticketId? })`

Alias of `workspacesForTicket(ctx, { ticketId? })`.

### `removeAllWorktreesForTicket(ctx, { ticketId? })`

Best-effort removes every worktree attached to the resolved ticket and returns the number removed.

### `runCommand(cwd, command, options?)`

Runs a command, captures `stdout` and `stderr` by default, and returns `{ exitCode, stdout, stderr }`.

### `setTicketStatus(ctx, { ticket, status })`

Resolves the ticket and status name, updates the ticket, and returns `true` when both are found.

### `setWorkspaceAttemptStatus(ctx, { workspaceId?, statusName, sessionId? })`

Resolves the workspace, updates its attempt status, and returns `true` when the workspace is found. When `ctx.workspace` already matches, it uses that object directly instead of listing workspaces first.

### `updateTicketWhenAllAttemptsMatch(ctx, { ticketId?, allAttemptsStatus, setStatus })`

Uses the server-side `update-when-attempt-status` endpoint and returns the `updated` flag.

### `pullTickets(ctx, { rootPath, ticketId?, force?, log? })`

Pulls one ticket or all non-archived tickets into `.pstdio/tickets/...`, writes frontmatter, and downloads attachments.

### `bootstrapWorktree(ctx, { repoPath, worktreePath, ticketId? })`

Copies `.pstdio/config.json`, mirrors `.claude`, `.opencode`, and `.agents`, and optionally pulls the ticket into the worktree.

## `@pstdio/sdk/prompts`

### `renderPrompt(template: string, data: Record<string, unknown>)`

Renders a prompt template with Mustache.

## Type-Only Entry Points

- `@pstdio/sdk/api`
  Request and response types for client calls.
- `@pstdio/sdk/resources`
  API resource shapes such as `Ticket`, `Session`, `Workspace`, and `Project`.
- `@pstdio/sdk/hooks`
  Hook context types such as `TicketContext`, `SessionHookContext`, `WorktreeContext`, and `AttemptStatusChangeContext`.
