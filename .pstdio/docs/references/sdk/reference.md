# SDK Method Reference

This page lists the current runtime APIs and key public types exported by
`@pstdio/sdk` and its public subpaths.

`@pstdio/sdk/api`, `@pstdio/sdk/resources`, and `@pstdio/sdk/extensions` provide
shared types. Runtime helpers live on their dedicated subpaths.

Planner tickets, ticket statuses, and ticket tags are extension-owned. They do
not have core SDK domain clients; use the planner extension commands or the
`pst tickets` CLI facade.

## `@pstdio/sdk`

The root export is a curated convenience surface.

### `createClient(options?: ClientOptions)`

Re-export of the main SDK client factory from `@pstdio/sdk/client`.

### `new PstdioApiError(message: string, status: number)`

Re-export of the SDK HTTP error class from `@pstdio/sdk/client`.

## `@pstdio/sdk/client`

### `createClient(options?: ClientOptions)`

Creates a fully wired `PstdioClient` with `projects`, `workspaces`, `sessions`,
`templates`, `skills`, `agents`, `extensions`, `settings`, and `sync`.

### `createRequest(options: ClientOptions)`

Creates the low-level request function used by the domain clients.

### `new PstdioApiError(message: string, status: number)`

Thrown by request helpers and client methods when the API responds with a
non-2xx status.

### Key Types

- `type ClientOptions`
- `type PstdioClient`
- `type RequestFn`

## Client Domains

- `client.projects.list()`
- `client.projects.get(projectId)`
- `client.projects.create(input)`
- `client.projects.delete(projectId)`
- `client.projects.listActivity(projectId, input?)`
- `client.projects.listRepos(projectId)`
- `client.projects.registerRepo(projectId, input)`
- `client.projects.removeRepo(projectId, repoId)`
- `client.workspaces.list(projectId)`
- `client.workspaces.getByShorthand(projectId, shorthand)`
- `client.workspaces.create(input)`
- `client.workspaces.rename(workspaceId, input)`
- `client.workspaces.listActivity(workspaceId, input?)`
- `client.workspaces.removeWorktree(workspaceId)`
- `client.workspaces.delete(workspaceId)`
- `client.sessions.list(projectId, input?)`
- `client.sessions.get(sessionId)`
- `client.sessions.create(input)`
- `client.sessions.archive(sessionId)`
- `client.sessions.followUp(sessionId, input)`
- `client.sessions.approve(sessionId, input)`
- `client.sessions.getConversation(sessionId)`
- `client.sessions.resolveSessionId(input)`
- `client.sessions.updateStatus(sessionId, status)`
- `client.sessions.listActivity(sessionId, input?)`
- `client.sessions.stream(sessionId, onEvent, options?)`
- `client.sessions.connectStream(sessionId, handlers, options?)`
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
- `client.extensions.enableInstalled(projectId, installName, input)`
- `client.extensions.updateInstalledTemplate(installName, templateKey, input)`
- `client.extensions.listAppearance(projectId)`
- `client.extensions.listCommands(projectId)`
- `client.extensions.execute(commandId, input)`
- `client.settings.get()`
- `client.settings.update(input)`
- `client.sync.connect(input)`

## Planner Command Access

Use `client.extensions.execute(...)` when programmatic callers need planner
ticket results:

```ts
const result = await client.extensions.execute("pstdio-planner.list-tickets", {
  projectId,
  params: { status: "In Progress" },
});
```

Normal user workflows should prefer the CLI facade:

```sh
pst tickets list --status "In Progress"
pst tickets save --id PS-12
```

## `@pstdio/sdk/extensions`

Exports extension authoring contracts, including `ExtensionDefinition`,
lifecycle event payload types, command context types, and extension resource
APIs.

## `@pstdio/sdk/prompts`

### `renderPrompt(template: string, data: unknown)`

Renders a Mustache template with the provided data.
