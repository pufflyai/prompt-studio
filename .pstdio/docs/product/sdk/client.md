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
client.skills; // Skill listing and preferences
client.agents; // Harness availability and models
client.extensions; // Extension command execution and metadata
client.automation; // Scoped tokens and durable automation runs
client.notifications; // Project inbox items and resolution
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
  provider_id: "pstdio.worktree",
});
await client.workspaces.delete(workspaceId);
```

## Skills

```ts
const skills = await client.skills.list(projectId);
const skill = await client.skills.get(projectId, skillId);
```

## Agents

```ts
const agents = await client.agents.info({ project: projectId });
const models = await client.agents.models("claude-code");
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
const response = await client.extensions.execute("pstdio.pstdio-planner.command.list-tickets", {
  projectId,
  params: {},
});

if (response.outcome.status === "success") {
  console.log(response.outcome.value);
}
```

Discover qualified IDs with `client.extensions.listCommands(projectId)`. HTTP
success returns a command outcome; inspect its status before reading its value.

## Connections and remote automation

Runtime-authenticated clients configure named extension connections. The secret is sent only when it is created or replaced and is never returned by list calls.

These examples assume your enabled `acme.remote` extension declares a
`control-plane` connection and a `launch` command with `automation: true` and a
`ticketId` parameter. Replace those names with your provider's contract. Planner's
normal workflow commands do not opt into remote automation automatically.

```ts
await client.extensions.configureConnection(projectId, "acme.remote", "control-plane", {
  baseUrl: "https://control.example.com",
  secret: process.env.REMOTE_CONTROL_TOKEN,
});
const checked = await client.extensions.checkConnection(projectId, "acme.remote", "control-plane");

const issued = await client.automation.issueToken({
  name: "notion-trigger",
  projectId,
  commandScopes: ["acme.remote.command.launch"],
  expiresInSeconds: 30 * 24 * 60 * 60,
});
```

Token rotation can preserve the same project-scoped principal and idempotency history by passing the `principalId` returned with the original token:

```ts
const replacement = await client.automation.issueToken({
  name: "notion-trigger-rotated",
  projectId,
  principalId: issued.principalId,
  commandScopes: ["acme.remote.command.launch"],
  expiresInSeconds: 30 * 24 * 60 * 60,
});
```

Create a second client with the returned machine token. That client can call its allowed automation routes but cannot use normal project or settings routes.

```ts
const machine = createClient({ baseUrl, token: issued.token });
const run = await machine.automation.createRun(projectId, "notion-page-123-revision-7", {
  commandId: "acme.remote.command.launch",
  input: { params: { ticketId: "PS-294" } },
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

## Client reference

The `fetch` option accepts a replacement compatible with the runtime's `typeof fetch`.
See the [method reference](../../references/sdk/reference.md) for all client groups
and links to their current request and response types.
