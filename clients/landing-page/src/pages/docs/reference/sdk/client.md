---
layout: ../../../../layouts/docs-layout.astro
title: SDK client
description: Every method on createClient(), grouped by resource namespace.
htmlTitle: SDK client reference
htmlDescription: Every method on createClient() in @pstdio/sdk, grouped by resource namespace.
section: References
category: SDK
categoryOrder: 2
order: 1
---

## createClient

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient(options?);
```

**`options`** — optional `ClientOptions`:

- `baseUrl?: string` — API base URL. Defaults to `PSTDIO_API_URL` or `http://localhost:19840`.
- `token?: string` — bearer token. Sent on every `/v1` request when set.
- `fetch?: typeof fetch` — custom fetch implementation.

Returns a `PstdioClient` exposing `projects`, `tickets`, `workspaces`, `sessions`, `statuses`, `tags`, `templates`, `skills`, `agents`, and `actions`.

## createRequest

```ts
import { createRequest } from "@pstdio/sdk/client";

const request = createRequest(options);
const body = await request<Project[]>("/v1/projects");
```

Returns the underlying request function `<T>(path: string, options?: RequestOptions) => Promise<T>` used internally by every resource client.

## PstdioApiError

Thrown by every failing request. Fields:

- `message: string` — error message from the API.
- `status: number` — HTTP status code.

```ts
try {
  await client.tickets.get("missing-id");
} catch (err) {
  if (err instanceof PstdioApiError) console.error(err.status, err.message);
}
```

## client.projects

### list

```ts
list(): Promise<Project[]>
```

`GET /v1/projects` — list all projects.

### get

```ts
get(projectId: string): Promise<Project>
```

`GET /v1/projects/{projectId}` — retrieve a project.

### create

```ts
create(input: CreateProjectInput): Promise<Project>
```

`POST /v1/projects` — create a new project.

### delete

```ts
delete(projectId: string): Promise<void>
```

`DELETE /v1/projects/{projectId}`.

### listPlugins

```ts
listPlugins(projectId: string): Promise<RegisteredPluginsResponse>
```

`GET /v1/projects/{projectId}/plugins`.

### registerPlugins

```ts
registerPlugins(projectId: string): Promise<RegisteredPluginsResponse>
```

`POST /v1/projects/{projectId}/plugins/register`.

### listRepos

```ts
listRepos(projectId: string): Promise<Repo[]>
```

`GET /v1/projects/{projectId}/repos`.

### registerRepo

```ts
registerRepo(projectId: string, input: RegisterRepoInput): Promise<Repo>
```

`POST /v1/projects/{projectId}/repos`.

### removeRepo

```ts
removeRepo(projectId: string, repoId: string): Promise<void>
```

`DELETE /v1/projects/{projectId}/repos/{repoId}`.

## client.tickets

### list

```ts
list(projectId: string, input?: ListTicketsInput): Promise<TicketListItem[]>
```

`GET /v1/tickets` — supports `status`, `tag`, `archived`, `draft`, `parent_id`, `shorthand`, `search` filters.

### get

```ts
get(ticketId: string): Promise<TicketDetail>
```

`GET /v1/tickets/{id}`.

### create

```ts
create(input: CreateTicketInput): Promise<Ticket>
```

`POST /v1/tickets`.

### update

```ts
update(ticketId: string, input: UpdateTicketInput): Promise<Ticket>
```

`PATCH /v1/tickets/{id}`.

### delete

```ts
delete(ticketId: string): Promise<void>
```

`DELETE /v1/tickets/{id}`.

### createAttempt

```ts
createAttempt(ticketId: string, input: CreateTicketAttemptInput): Promise<TicketAttemptResponse>
```

`POST /v1/tickets/{id}/attempts`.

### updateWhenAttemptStatus

```ts
updateWhenAttemptStatus(ticketId: string, input: UpdateWhenAttemptStatusInput): Promise<UpdateWhenAttemptStatusResponse>
```

`POST /v1/tickets/{id}/update-when-attempt-status`.

### listFiles

```ts
listFiles(ticketId: string): Promise<TicketFile[]>
```

`GET /v1/tickets/{id}/files`.

### getFileContent

```ts
getFileContent(ticketId: string, fileId: string): Promise<Uint8Array>
```

`GET /v1/tickets/{id}/files/{fileId}/content`.

### uploadFile

```ts
uploadFile(ticketId: string, input: UploadTicketFileInput): Promise<TicketFile>
```

`POST /v1/tickets/{id}/files`.

### deleteFile

```ts
deleteFile(ticketId: string, fileId: string): Promise<void>
```

`DELETE /v1/tickets/{id}/files/{fileId}`.

## client.workspaces

### list

```ts
list(projectId: string): Promise<WorkspaceListItem[]>
```

`GET /v1/workspaces`.

### getByShorthand

```ts
getByShorthand(projectId: string, shorthand: string): Promise<Workspace>
```

`GET /v1/workspaces/by-shorthand`.

### create

```ts
create(input: CreateWorkspaceInput): Promise<Workspace>
```

`POST /v1/workspaces`.

### updateAttemptStatus

```ts
updateAttemptStatus(workspaceId: string, input: UpdateAttemptStatusInput): Promise<UpdateAttemptStatusResponse>
```

`PATCH /v1/workspaces/{id}/attempt-status`.

### removeWorktree

```ts
removeWorktree(workspaceId: string): Promise<RemoveWorktreeResponse>
```

`POST /v1/workspaces/{id}/remove-worktree`.

### delete

```ts
delete(workspaceId: string): Promise<void>
```

`DELETE /v1/workspaces/{id}`.

## client.sessions

### list

```ts
list(projectId: string): Promise<Session[]>
```

`GET /v1/sessions`.

### get

```ts
get(sessionId: string): Promise<Session>
```

`GET /v1/sessions/{id}`.

### create

```ts
create(input: CreateSessionInput): Promise<Session>
```

`POST /v1/sessions`.

### archive

```ts
archive(sessionId: string): Promise<void>
```

`POST /v1/sessions/{id}/archive`.

### followUp

```ts
followUp(sessionId: string, input: FollowUpInput): Promise<Session>
```

`POST /v1/sessions/{id}/follow-up`.

### approve

```ts
approve(sessionId: string, input: ApprovalInput): Promise<void>
```

`POST /v1/sessions/{id}/approve`.

### getConversation

```ts
getConversation(sessionId: string): Promise<SessionConversationResponse>
```

`GET /v1/sessions/{id}/conversation`.

### resolveSessionId

```ts
resolveSessionId(input: ResolveSessionIdInput): Promise<ResolveSessionIdResponse>
```

`POST /v1/sessions/resolve-session-id`.

### updateStatus

```ts
updateStatus(sessionId: string, status: string): Promise<Session>
```

`PATCH /v1/sessions/{id}/status`.

## client.statuses

### list

```ts
list(projectId: string): Promise<Status[]>
```

`GET /v1/projects/{projectId}/statuses`.

### create

```ts
create(projectId: string, input: CreateStatusInput): Promise<Status>
```

`POST /v1/projects/{projectId}/statuses`.

### update

```ts
update(projectId: string, statusId: string, input: { color?: string }): Promise<Status>
```

`PATCH /v1/projects/{projectId}/statuses/{id}`.

### setDefault

```ts
setDefault(projectId: string, statusId: string): Promise<void>
```

`PATCH /v1/projects/{projectId}/statuses/{id}/set-default`.

### delete

```ts
delete(projectId: string, statusId: string): Promise<void>
```

`DELETE /v1/projects/{projectId}/statuses/{id}`.

### listAttemptStatuses

```ts
listAttemptStatuses(projectId: string): Promise<AttemptStatus[]>
```

`GET /v1/projects/{projectId}/attempt-statuses`.

### createAttemptStatus

```ts
createAttemptStatus(projectId: string, input: CreateAttemptStatusInput): Promise<AttemptStatus>
```

`POST /v1/projects/{projectId}/attempt-statuses`.

### updateAttemptStatus

```ts
updateAttemptStatus(
  projectId: string,
  statusId: string,
  input: { name?: string; color?: string; sort_order?: number; is_default?: boolean }
): Promise<AttemptStatus>
```

`PATCH /v1/projects/{projectId}/attempt-statuses/{id}`.

### deleteAttemptStatus

```ts
deleteAttemptStatus(projectId: string, statusId: string): Promise<void>
```

`DELETE /v1/projects/{projectId}/attempt-statuses/{id}`.

## client.tags

### list

```ts
list(projectId: string): Promise<Tag[]>
```

`GET /v1/projects/{projectId}/ticket-tags`.

### create

```ts
create(projectId: string, input: CreateTagInput): Promise<Tag>
```

`POST /v1/projects/{projectId}/ticket-tags`.

### update

```ts
update(projectId: string, tagId: string, input: UpdateTagInput): Promise<Tag>
```

`PUT /v1/projects/{projectId}/ticket-tags/{tagId}`.

### delete

```ts
delete(projectId: string, tagId: string): Promise<void>
```

`DELETE /v1/projects/{projectId}/ticket-tags/{tagId}`.

### createOption

```ts
createOption(projectId: string, tagId: string, input: CreateTagOptionInput): Promise<TagOption>
```

`POST /v1/projects/{projectId}/ticket-tags/{tagId}/options`.

### updateOption

```ts
updateOption(
  projectId: string,
  tagId: string,
  optionId: string,
  input: UpdateTagOptionInput
): Promise<TagOption>
```

`PUT /v1/projects/{projectId}/ticket-tags/{tagId}/options/{optionId}`.

### deleteOption

```ts
deleteOption(projectId: string, tagId: string, optionId: string): Promise<void>
```

`DELETE /v1/projects/{projectId}/ticket-tags/{tagId}/options/{optionId}`.

## client.templates

### list

```ts
list(projectId: string): Promise<Template[]>
```

`GET /v1/projects/{projectId}/templates`.

### get

```ts
get(projectId: string, templateId: string): Promise<TemplateWithContent>
```

`GET /v1/projects/{projectId}/templates/{name}`.

### create

```ts
create(projectId: string, input: CreateTemplateInput): Promise<Template>
```

`POST /v1/projects/{projectId}/templates`.

### update

```ts
update(projectId: string, templateId: string, input: UpdateTemplateInput): Promise<Template>
```

`PUT /v1/projects/{projectId}/templates/{name}`.

### delete

```ts
delete(projectId: string, templateId: string): Promise<void>
```

`DELETE /v1/projects/{projectId}/templates/{name}`.

## client.skills

### list

```ts
list(projectId: string): Promise<Skill[]>
```

`GET /v1/projects/{projectId}/skills`.

### get

```ts
get(projectId: string, skillId: string): Promise<SkillWithContent>
```

`GET /v1/projects/{projectId}/skills/{name}`.

### update

```ts
update(projectId: string, skillName: string): Promise<SkillWithContent>
```

`POST /v1/projects/{projectId}/skills/{name}/update` — re-read the skill from source.

## client.agents

### list

```ts
list(): Promise<AgentConfig[]>
```

`GET /v1/agents`.

### info

```ts
info(): Promise<AgentInfo[]>
```

`GET /v1/agents/info`.

### models

```ts
models(agentId: string): Promise<AgentModel[]>
```

`GET /v1/agents/{agentId}/models`.

### setup

```ts
setup(input: SetupAgentInput): Promise<AgentConfig>
```

`POST /v1/agents`.

### setupAvailable

```ts
setupAvailable(input: SetupAvailableAgentsInput): Promise<AgentConfig[]>
```

`POST /v1/agents/setup-available`.

### update

```ts
update(agentId: string, input: UpdateAgentInput): Promise<AgentConfig>
```

`PATCH /v1/agents/{agentId}`.

### delete

```ts
delete(agentId: string): Promise<void>
```

`DELETE /v1/agents/{agentId}`.

## client.actions

### list

```ts
list(projectId: string, targetType?: TargetType): Promise<ActionDescriptor[]>
```

`GET /v1/projects/{projectId}/actions` — optionally filtered by `targetType`.

### execute

```ts
execute(projectId: string, actionKey: string, input: ExecuteActionInput): Promise<ActionResult>
```

`POST /v1/projects/{projectId}/actions/{actionKey}/execute`.
