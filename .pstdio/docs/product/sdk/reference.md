# SDK Method Reference

This page lists the current runtime APIs and key public types exported by `@pstdio/sdk` and its public subpaths.

`@pstdio/sdk/api` and `@pstdio/sdk/resources` are type-only entrypoints. They do not export runtime methods.

## Extension Package Boundary

`@pstdio/sdk` is generic platform substrate. It must not import from extension packages or export extension-specific contracts/clients. Extension packages may use the SDK and may publish their own contract or SDK subpaths, such as `@pstdio/pstdio-ext-planner/contract`.

When an API surface is owned by an extension workflow, document the typed helpers under that extension package instead of adding them to this SDK reference.

## `@pstdio/sdk`

The package currently publishes subpath exports only. Import from the specific entrypoint you need.

### Root Notes

- Use `@pstdio/sdk/client` for the HTTP client.
- Use `@pstdio/sdk/api` and `@pstdio/sdk/resources` for type-only imports.
- Use `@pstdio/sdk/extensions` and `@pstdio/sdk/prompts` for their dedicated runtime helpers.

## `@pstdio/sdk/client`

### `createClient(options?: ClientOptions)`

Creates a fully wired `PstdioClient` with core API domain groups such as `projects`, `tickets`, `workspaces`, `sessions`, `statuses`, `tags`, `templates`, `skills`, `harnesses`, and `actions`.

Extension-specific clients do not belong in `@pstdio/sdk/client`; they belong to the owning extension package SDK.

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

### `client.harnesses.list()`

Lists configured harness providers.

### `client.harnesses.info()`

Lists known harness provider definitions and their availability.

### `client.harnesses.setup(input: SetupHarnessInput)`

Creates initial configuration for a harness provider.

### `client.harnesses.update(harnessId: string, input: UpdateHarnessInput)`

Updates a harness provider configuration.

### `client.harnesses.delete(harnessId: string)`

Deletes a harness provider configuration.

### `client.actions.list(projectId: string, targetType?: TargetType)`

Lists registered UI actions for a project, optionally filtered to a target type.

### `client.actions.execute(projectId: string, actionKey: string, input: ExecuteActionInput)`

Executes a registered action for the provided target within a project.

## `@pstdio/sdk/extensions`

Generic v2 extension authoring primitives and runtime types.

### `defineExtension(extension: ExtensionDefinition)`

Validates and returns an extension definition.

### `defineSlot(slot: SlotDefinition)`

Returns a generic slot definition owned by the surface that renders it.

### `defineEvent(event: EventDefinition)`

Returns a generic event definition.

### `defineResource(resource: ResourceDefinition)`

Returns a generic resource definition.

### `packageAsset(sourcePath: string, baseUrl: string | URL)`

Creates a package asset descriptor for read-only extension assets.

### `params`

Factory helpers for generic command parameter definitions.

### Boundary Notes

- Generic extension primitives live here.
- Workflow-specific slots, events, planner ticket-management contracts, and typed clients live in the owning extension package.
- Planner integrations should import planner helpers from `@pstdio/pstdio-ext-planner/contract` or `@pstdio/pstdio-ext-planner/sdk`, not from `@pstdio/sdk/extensions`.

## `@pstdio/sdk/prompts`

### `renderPrompt(template: string, data: Record<string, unknown>)`

Renders a prompt template with Mustache.

## Type-Only Entry Points

- `@pstdio/sdk/api`
  Request and response types for client calls.
- `@pstdio/sdk/resources`
  API resource shapes such as `Ticket`, `Session`, `Workspace`, and `Project`.
