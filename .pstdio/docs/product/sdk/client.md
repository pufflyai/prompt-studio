# Client

The SDK client provides typed methods for every pstdio API endpoint.

## Creating a Client

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient({
  baseUrl: "http://localhost:19840", // default: PSTDIO_API_URL env or http://localhost:19840
  token: "...", // optional: Bearer token (matches PSTDIO_API_TOKEN)
});
```

All options are optional. With no arguments, the client reads `PSTDIO_API_URL` from the environment and connects without authentication.

### Options

| Option    | Type           | Default                                                  | Description                                      |
| --------- | -------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `baseUrl` | `string`       | `process.env.PSTDIO_API_URL` or `http://localhost:19840` | API server URL                                   |
| `token`   | `string`       | —                                                        | Bearer token for authenticated requests          |
| `fetch`   | `typeof fetch` | `globalThis.fetch`                                       | Custom fetch implementation (useful for testing) |

## Domain Groups

The client is organized by resource type:

```ts
client.projects; // Project CRUD
client.tickets; // Ticket CRUD, attempts, files
client.sessions; // Session CRUD, follow-up, approval
client.workspaces; // Workspace CRUD
client.statuses; // Status CRUD
client.tags; // Tag and tag option CRUD
client.templates; // Template CRUD
client.skills; // Skill listing (read-only)
client.agents; // Agent configuration
```

## Projects

```ts
const projects = await client.projects.list();
const project = await client.projects.get(projectId);
const created = await client.projects.create({ name: "My Project" });
await client.projects.delete(projectId);
```

## Tickets

```ts
const tickets = await client.tickets.list(projectId);
const ticket = await client.tickets.get(ticketId);
const created = await client.tickets.create({
  project_id: projectId,
  content: "# Bug\n\nSomething is broken",
});
await client.tickets.update(ticketId, { display_title: "Fix the bug" });
await client.tickets.delete(ticketId);

// Attempts
const attempt = await client.tickets.createAttempt(ticketId, {
  agent: "claude-code",
  mode: "worktree",
  start_session: true,
});

// Files
const files = await client.tickets.listFiles(ticketId);
await client.tickets.uploadFile(ticketId, {
  file_name: "screenshot.png",
  content_base64: "...",
  mime_type: "image/png",
});
```

## Sessions

```ts
const sessions = await client.sessions.list(projectId);
const session = await client.sessions.get(sessionId);
const created = await client.sessions.create(projectId, {
  project_id: projectId,
  title: "Fix the bug",
  prompt: "Please fix the login page",
  agent: "claude-code",
});

await client.sessions.followUp(sessionId, { prompt: "Also fix the logout" });
await client.sessions.approve(sessionId, {
  id: requestId,
  decision: "approve",
});
await client.sessions.archive(sessionId);

const conversation = await client.sessions.getConversation(sessionId);
```

## Workspaces

```ts
const workspaces = await client.workspaces.list(projectId);
const workspace = await client.workspaces.get(workspaceId);
await client.workspaces.delete(workspaceId);
```

## Statuses

```ts
const statuses = await client.statuses.list(projectId);
await client.statuses.create(projectId, { name: "review", color: "#FFA500" });
await client.statuses.delete(projectId, statusId);
```

## Tags

```ts
const tags = await client.tags.list(projectId);
const tag = await client.tags.create(projectId, {
  name: "Priority",
  type: "single_select",
  options: [{ name: "High", color: "#FF0000" }],
});
await client.tags.createOption(projectId, tagId, {
  name: "Low",
  color: "#00FF00",
});
```

## Templates

```ts
const templates = await client.templates.list(projectId);
const template = await client.templates.get(projectId, templateId);
await client.templates.create(projectId, {
  name: "bug-report",
  template_type: "ticket",
  content: "# Bug Report\n\n## Steps to Reproduce\n...",
});
```

## Skills

```ts
const skills = await client.skills.list(projectId);
const skill = await client.skills.get(projectId, skillId);
```

## Agents

```ts
const agents = await client.agents.list();
const info = await client.agents.info();
await client.agents.setup({ agent_id: "claude-code" });
```

## Error Handling

All client methods throw `PstdioApiError` on non-2xx responses:

```ts
import { PstdioApiError } from "@pstdio/sdk/client";

try {
  await client.projects.get("nonexistent");
} catch (err) {
  if (err instanceof PstdioApiError) {
    console.log(err.status); // 404
    console.log(err.message); // "Project not found"
  }
}
```

## Testing

Use the `fetch` option to mock the HTTP layer:

```ts
const mockFetch = (url, init) => {
  return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
};

const client = createClient({ baseUrl: "http://test", fetch: mockFetch });
```
