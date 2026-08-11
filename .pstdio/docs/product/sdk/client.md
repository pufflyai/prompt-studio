# Client

The SDK client provides typed methods for the core pstdio API endpoints.
Planner tickets, ticket statuses, and ticket tags are extension-owned and are
accessed through extension commands or the `pst tickets` CLI facade, not through
core SDK domain clients.

## Creating a Client

```ts
import { createClient } from "@pstdio/sdk/client";

const client = createClient({
  baseUrl: "http://127.0.0.1:43123", // default: PSTDIO_API_URL env or http://127.0.0.1:19840
  token: "...", // optional: defaults to PSTDIO_API_TOKEN outside the browser
});
```

All options are optional. With no arguments, a non-browser client reads `PSTDIO_API_URL` and `PSTDIO_API_TOKEN` from
the environment. Browser requests use same-origin credentials so the runtime's HttpOnly session cookie authenticates
REST and SSE without exposing the bearer token to JavaScript.

### Options

| Option    | Type           | Default                                                  | Description                                      |
| --------- | -------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `baseUrl` | `string`       | `process.env.PSTDIO_API_URL` or `http://127.0.0.1:19840` | API server URL                                   |
| `token`   | `string`       | `process.env.PSTDIO_API_TOKEN` outside the browser       | Bearer token for authenticated requests          |
| `fetch`   | `typeof fetch` | `globalThis.fetch`                                       | Custom fetch implementation (useful for testing) |

## Domain Groups

The client is organized by resource type:

```ts
client.projects; // Project CRUD
client.workspaces; // Workspace CRUD
client.sessions; // Session CRUD, follow-up, approval, stream
client.templates; // Template CRUD
client.skills; // Skill listing (read-only)
client.agents; // Agent configuration
client.extensions; // Extension command execution and metadata
client.settings; // Global settings
client.sync; // SSE sync helpers
client.runtime; // Browser-session provisioning
```

Desktop main processes can provision the dedicated browser session through `client.runtime.provisionBrowserSession()`.
The request uses the bearer header, returns no token payload, and sets the `HttpOnly; SameSite=Strict` cookie. Do not
forward the descriptor token into renderer JavaScript.

## Projects

```ts
const projects = await client.projects.list();
const project = await client.projects.get(projectId);
const created = await client.projects.create({ name: "My Project" });
await client.projects.delete(projectId);
```

## Sessions

```ts
const sessions = await client.sessions.list(projectId);
const session = await client.sessions.get(sessionId);
const attachment = await client.sessions.uploadAttachment(projectId, {
  name: "notes.txt",
  data: new TextEncoder().encode("context"),
  mimeType: "text/plain",
});
const created = await client.sessions.create({
  project_id: projectId,
  title: "Fix the bug",
  prompt: "Please fix the login page",
  agent: "claude-code",
  attachments: [{ file_id: attachment.file_id }],
});

await client.sessions.followUp(sessionId, {
  prompt: "Also fix the logout",
  attachments: [{ file_id: attachment.file_id }],
});
await client.sessions.approve(sessionId, {
  id: requestId,
  decision: "approve",
});
await client.sessions.archive(sessionId);
await client.sessions.deleteAttachment(projectId, attachment.file_id);

const conversation = await client.sessions.getConversation(sessionId);
```

## Workspaces

```ts
const workspaces = await client.workspaces.list(projectId);
const workspace = await client.workspaces.getByShorthand(projectId, "A0001");
const created = await client.workspaces.create({
  project_id: projectId,
  repo_id: repoId,
  type: "worktree",
});
await client.workspaces.delete(workspaceId);
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

## Extension-Owned Planner Tickets

The planner extension owns ticket data. Use the CLI for normal automation:

```sh
pst tickets create --content "# Fix login bug"
pst tickets save --id PS-12
pst tickets list --json
```

Programmatic callers can execute planner commands through the extension command
API when they need direct command results:

```ts
await client.extensions.execute("pstdio-planner.list-tickets", {
  projectId,
  params: {},
});
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
