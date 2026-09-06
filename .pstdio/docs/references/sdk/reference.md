# SDK method reference

Import a declared `@pstdio/sdk` subpath. The package has no root entry point.
The [package guide](../../../../packages/sdk/README.md) lists all supported entries
and their dependency requirements.

## HTTP client

```ts
import { createClient, PstdioApiError } from "@pstdio/sdk/client";

const client = createClient();
const projects = await client.projects.list();
```

`createClient(options?: ClientOptions)` accepts `baseUrl`, `token`, and `fetch`.
Outside the browser, it reads `PSTDIO_API_URL` and `PSTDIO_API_TOKEN` when those
options are omitted. The fallback URL is `http://127.0.0.1:19840`.

`createRequest(options: ClientOptions)` returns the low-level request function.
HTTP failures throw `PstdioApiError`, which exposes `message` and `status`.
See the [request types](../../../../packages/sdk/src/client/request.ts) for request
headers, cancellation, and other options.

The client exposes these groups. Each link contains the current method signatures
and request and response types.

| Group | Methods | Contract |
| --- | --- | --- |
| `projects` | `list`, `get`, `create`, `delete`, `listActivity`, `listRepos`, `registerRepo`, `removeRepo` | [ProjectClient](../../../../packages/sdk/src/client/projects.ts) |
| `workspaces` | `list`, `getByShorthand`, `create`, `rename`, `listActivity`, `listFiles`, `createDirectory`, `createFile`, `readFile`, `writeFile`, `moveEntry`, `deleteEntry`, `removeWorktree`, `delete` | [WorkspaceClient](../../../../packages/sdk/src/client/workspaces.ts) |
| `sessions` | `list`, `get`, `uploadAttachment`, `deleteAttachment`, `create`, `archive`, `followUp`, `approve`, `getConversation`, `resolveSessionId`, `updateStatus`, `listActivity`, `stream`, `connectStream` | [SessionClient](../../../../packages/sdk/src/client/sessions.ts) |
| `skills` | `list`, `get`, `updatePreferences` | [SkillClient](../../../../packages/sdk/src/client/skills.ts) |
| `agents` | `info`, `models` | [AgentClient](../../../../packages/sdk/src/client/agents.ts) |
| `extensions` | `enableInstalled`, `listAppearance`, `listCommands`, `listProject`, `upgradeProject`, `listConnections`, `configureConnection`, `checkConnection`, `deleteConnection`, `execute`, `dispatchEvent` | [ExtensionClient](../../../../packages/sdk/src/client/extensions.ts) |
| `automation` | `issueToken`, `listTokens`, `revokeToken`, `createRun`, `getRun`, `listRunEvents`, `cancelRun` | [AutomationClient](../../../../packages/sdk/src/client/automation.ts) |
| `notifications` | `list`, `count`, `get`, `create`, `update`, `markRead`, `dismiss`, `markDone`, `snooze`, `resolveByDedupeKey` | [NotificationsClient](../../../../packages/sdk/src/client/notifications.ts) |
| `settings` | `get`, `update` | [SettingsClient](../../../../packages/sdk/src/client/settings.ts) |
| `sync` | `start` | [SyncClient](../../../../packages/sdk/src/client/sync.ts) |
| `runtime` | `provisionBrowserSession` | [RuntimeClient](../../../../packages/sdk/src/client/runtime.ts) |

See the [client guide](../../product/sdk/client.md) for sessions, file attachments,
connections, and remote automation examples.

## Planner commands

Tickets, statuses, and tags belong to the Planner extension. Use its commands
through `client.extensions.execute`, or use the `pst tickets` CLI aliases.
The installed extension must be enabled in the project.

```ts
const response = await client.extensions.execute("pstdio.pstdio-planner.command.list-tickets", {
  projectId,
  params: { status: "In Progress" },
});

if (response.outcome.status === "success") {
  console.log(response.outcome.value);
}
```

Use `client.extensions.listCommands(projectId)` to discover command IDs. IDs include
the publisher, extension name, contribution kind, and local ID. Do not construct
them from the package name alone.

## Extension authoring

`@pstdio/sdk/extensions` exports contribution helpers, typed references, command
and renderer contexts, storage contracts, and the webview client. The current host
extension contract is `1.0.0-alpha.10`; extensions declare that exact value in
`engines.pstdio`.

Use the [composition cookbook](../../extensions/cookbook.md) for `definePage`,
shared placement items, resource identity, navigation, controls, `qualifyRef`,
and typed `GuestHost.call` capabilities. The
[React entry](../../../../packages/sdk/src/extensions/react/index.ts) provides
`useCommandQuery` and `useCommandMutation` for webviews.

## Other entries

- `@pstdio/sdk/api` exports HTTP request and response types.
- `@pstdio/sdk/resources` exports [product resource types](../../product/sdk/resources.md).
- `@pstdio/sdk/prompts` exports `renderPrompt(template, data)` for Mustache rendering.
- `@pstdio/sdk/hooks` exports hook API contracts.
