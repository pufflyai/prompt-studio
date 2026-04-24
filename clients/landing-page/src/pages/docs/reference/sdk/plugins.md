---
layout: ../../../../layouts/docs-layout.astro
title: SDK plugins
description: definePlugin, action and schedule shapes, and the plugin helpers.
htmlTitle: SDK plugins reference
htmlDescription: definePlugin, action and schedule shapes, and the plugin helpers exposed by @pstdio/sdk.
section: References
category: SDK
categoryOrder: 2
order: 2
---

## definePlugin

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  key?: string;
  actions?: ActionInput[];
  hooks?: PluginHooks;
  schedules?: ScheduleDefinition[];
});
```

`definePlugin` is a pass-through typed wrapper — it exists for IDE autocompletion. Default-export the call from a file under `.pstdio/plugins/`.

## Action shape

```ts
type ActionInput = {
  key: string;
  label: string;
  targetType: "ticket" | "workspace" | "session";
  placement: "primary" | "secondary" | "overflow";
  params?: ActionParamDef[];
  trigger: ActionTrigger;
};
```

### Param types

- **`text`** — `{ key, label, description?, required?, defaultValue? }`.
- **`longtext`** — multi-line textarea with the same fields as `text`.
- **`select`** — `{ …, options: [{ value, label }] }`.
- **`template-select`** — `{ …, templateType: "prompt" | "ticket" | "document" }`.
- **`agent`** — dropdown of configured agents.
- **`repo`** — dropdown of registered repos.

### Trigger context

```ts
type ActionTriggerContext = {
  client: PstdioClient;
  projectId: string;
  prompts: Record<string, string>;
  params: Record<string, ActionParamValue>;
  targetType: "ticket" | "workspace" | "session";
  targetId: string;
  target: TicketListItem | WorkspaceListItem | Session;
};

type ActionTrigger =
  | ((ctx: ActionTriggerContext) => void)
  | ((ctx: ActionTriggerContext) => ActionTriggerResult)
  | ((ctx: ActionTriggerContext) => Promise<ActionTriggerResult | undefined>);

type ActionTriggerResult = { session_id?: string; message?: string };
```

Return `{ session_id }` to navigate the dashboard to the new session, `{ message }` to show a toast.

## Schedule shape

```ts
type ScheduleDefinition = {
  name: string;
  cron: string;
  timeoutMs?: number;
  handler: (ctx: ScheduledTriggerContext) => void | Promise<void>;
};

type ScheduledTriggerContext = {
  client: PstdioClient;
  projectId: string;
  trigger: { type: "schedule" };
  scheduleName: string;
  scheduledFor: string;
  runId: string;
};
```

## renderPrompt

```ts
import { renderPrompt } from "@pstdio/sdk/prompts";

renderPrompt(template: string, data: Record<string, unknown>): string
```

Mustache substitution. Used internally when resolving `--template ... --var key=value` on CLI commands.

## Plugin helpers

Import helpers from `@pstdio/sdk/plugins/helpers`. Every helper takes `(ctx: PluginHelperContext, input)` where `ctx` is the hook or action context the plugin is already receiving.

### createAttempt

```ts
createAttempt(ctx, input: CreateAttemptHelperInput): Promise<TicketAttempt | null>
```

Create an attempt for a ticket and auto-start its session.

### createSession

```ts
createSession(ctx, input: CreateSessionHelperInput): Promise<Session>
```

Create a new session. `project_id` is supplied from `ctx` automatically.

### createWorkspace

```ts
createWorkspace(ctx, input: CreateWorkspaceHelperInput): Promise<Workspace | null>
```

Create a workspace (attempt) for a ticket without starting a session.

### findTicketByRef

```ts
findTicketByRef(ctx, input: TicketRef): Promise<TicketListItem | null>
```

Find by id or shorthand, checking the context cache first.

### findWorkspaceByRef

```ts
findWorkspaceByRef(ctx, input: WorkspaceRef): Promise<WorkspaceListItem | null>
```

Find by id or `workspace_shorthand`.

### followupSession

```ts
followupSession(ctx, input: FollowupSessionHelperInput): Promise<Session>
```

Send a follow-up message to an existing session.

### getAttemptsForTicket

```ts
getAttemptsForTicket(ctx, input: TicketRef): Promise<Workspace[]>
```

List every attempt workspace for a ticket.

### pullTickets

```ts
pullTickets(ctx, input: {
  rootPath: string;
  ticketId?: string;
  force?: boolean;
  log?: (message: string) => void;
}): Promise<{ pulledTicketShorthands: string[]; downloadedFileCount: number }>
```

Download ticket markdown and files into `{rootPath}/.pstdio/tickets/<shorthand>/`.

### saveTicket

```ts
saveTicket(ctx, input: {
  rootPath: string;
  ticketId?: string;
  status?: string;
  tags?: string[];
  log?: (message: string) => void;
}): Promise<{ ticketShorthand: string; uploadedFileCount: number }>
```

Upload local ticket markdown and files, stripping frontmatter from the body.

### setTicketStatus

```ts
setTicketStatus(ctx, input: { ticket: string; status: string }): Promise<boolean>
```

Update a ticket's status by name.

### setWorkspaceAttemptStatus

```ts
setWorkspaceAttemptStatus(ctx, input: WorkspaceRef & { statusName: string; sessionId?: string }): Promise<boolean>
```

Update an attempt's status by name.

### updateTicketWhenAllAttemptsMatch

```ts
updateTicketWhenAllAttemptsMatch(ctx, input: TicketRef & {
  allAttemptsStatus: string;
  setStatus: string;
}): Promise<boolean>
```

Bump a ticket status when every attempt matches `allAttemptsStatus`.

### workspacesForTicket

```ts
workspacesForTicket(ctx, input: TicketRef): Promise<WorkspaceListItem[]>
```

List every workspace tied to a ticket by shorthand.

### removeAllWorktreesForTicket

```ts
removeAllWorktreesForTicket(ctx, input: TicketRef): Promise<number>
```

Remove every worktree registered for a ticket. Returns the number of worktrees removed.

### runCommand

```ts
runCommand(
  cwd: string,
  command: string[],
  options?: { env?: NodeJS.ProcessEnv; quiet?: boolean }
): Promise<{ exitCode: number; stdout: string; stderr: string }>
```

Spawn a shell command from a worktree (via `Bun.spawn`) and capture output.

### bootstrapWorktree

```ts
bootstrapWorktree(ctx, input: {
  repoPath: string;
  worktreePath: string;
  ticketId?: string;
}): Promise<void>
```

Copy repo config and agent directories into a new worktree. Optionally `pullTickets` into it.

## Related pages

- [Use plugin actions](/docs/automation/plugin-actions/).
- [Use hooks](/docs/automation/hooks/).
- [Use schedules](/docs/automation/schedules/).
- [Hook reference](/docs/reference/sdk/hooks/) — hook names and context shapes.
