# SDK Method Reference

This page lists the current runtime APIs and key public types exported by `@pstdio/sdk` and its public subpaths.

`@pstdio/sdk/api`, `@pstdio/sdk/resources`, and `@pstdio/sdk/extensions` provide shared types. Runtime helpers live on their dedicated subpaths.

## `@pstdio/sdk`

The root export is a curated convenience surface.

### `createClient(options?: ClientOptions)`

Re-export of the main SDK client factory from `@pstdio/sdk/client`.

### `new PstdioApiError(message: string, status: number)`

Re-export of the SDK HTTP error class from `@pstdio/sdk/client`.

## `@pstdio/sdk/client`

### `createClient(options?: ClientOptions)`

Creates a fully wired `PstdioClient` with `projects`, `tickets`, `workspaces`, `sessions`, `statuses`, `tags`, `templates`, `skills`, and `agents`.

### `createRequest(options: ClientOptions)`

Creates the low-level request function used by the domain clients.

### `new PstdioApiError(message: string, status: number)`

Thrown by request helpers and client methods when the API responds with a non-2xx status.

### Key Types

- `type ClientOptions`
- `type PstdioClient`
- `type RequestFn`

## Client Domains

- `client.projects.list()`
- `client.projects.get(projectId)`
- `client.projects.create(input)`
- `client.projects.delete(projectId)`
- `client.projects.listRepos(projectId)`
- `client.projects.registerRepo(projectId, input)`
- `client.projects.removeRepo(projectId, repoId)`
- `client.tickets.list(projectId, input?)`
- `client.tickets.get(ticketId)`
- `client.tickets.create(input)`
- `client.tickets.update(ticketId, input)`
- `client.tickets.delete(ticketId)`
- `client.tickets.createAttempt(ticketId, input)`
- `client.tickets.updateWhenAttemptStatus(ticketId, input)`
- `client.tickets.listFiles(ticketId)`
- `client.tickets.getFileContent(ticketId, fileId)`
- `client.tickets.uploadFile(ticketId, input)`
- `client.tickets.deleteFile(ticketId, fileId)`
- `client.workspaces.list(projectId)`
- `client.workspaces.get(workspaceId)`
- `client.workspaces.getByShorthand(projectId, shorthand)`
- `client.workspaces.create(input)`
- `client.workspaces.updateAttemptStatus(workspaceId, input)`
- `client.workspaces.removeWorktree(workspaceId)`
- `client.workspaces.delete(workspaceId)`
- `client.sessions.list(projectId)`
- `client.sessions.get(sessionId)`
- `client.sessions.create(input)`
- `client.sessions.archive(sessionId)`
- `client.sessions.followUp(sessionId, input)`
- `client.sessions.approve(sessionId, input)`
- `client.sessions.getConversation(sessionId)`
- `client.sessions.resolveSessionId(input)`
- `client.sessions.updateStatus(sessionId, status)`
- `client.statuses.list(projectId)`
- `client.statuses.create(projectId, input)`
- `client.statuses.update(projectId, statusId, input)`
- `client.statuses.setDefault(projectId, statusId)`
- `client.statuses.delete(projectId, statusId)`
- `client.statuses.listAttemptStatuses(projectId)`
- `client.statuses.createAttemptStatus(projectId, input)`
- `client.statuses.updateAttemptStatus(projectId, statusId, input)`
- `client.statuses.deleteAttemptStatus(projectId, statusId)`
- `client.tags.list(projectId)`
- `client.tags.create(projectId, input)`
- `client.tags.update(projectId, tagId, input)`
- `client.tags.delete(projectId, tagId)`
- `client.tags.createOption(projectId, tagId, input)`
- `client.tags.updateOption(projectId, tagId, optionId, input)`
- `client.tags.deleteOption(projectId, tagId, optionId)`
- `client.templates.list(projectId)`
- `client.templates.get(projectId, templateId)`
- `client.templates.create(projectId, input)`
- `client.templates.update(projectId, templateId, input)`
- `client.templates.delete(projectId, templateId)`
- `client.skills.list(projectId)`
- `client.skills.get(projectId, skillId)`
- `client.skills.update(projectId, skillId, input)`
- `client.agents.list()`
- `client.agents.info()`
- `client.agents.models(agentId)`
- `client.agents.setup(input)`
- `client.agents.setupAvailable(agentId)`
- `client.agents.update(agentId, input)`
- `client.agents.delete(agentId)`

## `@pstdio/sdk/extensions`

Exports extension authoring contracts, including `ExtensionDefinition`, lifecycle event payload types, command context types, and extension resource APIs.

## `@pstdio/sdk/prompts`

### `renderPrompt(template: string, data: unknown)`

Renders a Mustache template with the provided data.
