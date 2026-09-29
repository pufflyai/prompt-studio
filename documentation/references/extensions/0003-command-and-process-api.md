# Extension commands and processes

Part of the [extension API reference](0001-api.md).

## Durable background work

Use `ctx.automation.enqueue({ command, input, key })` for work that lasts longer than a request. Read runs with `get` and `list`, and cancel them with `cancel`. Runs are scoped to the calling extension and project. Use `ctx.process` only for work the caller awaits. See [durable extension work](0007-durable-automation.md) for command flags, status events, restart behavior, and limits.

## Detached processes

Use `ctx.process.spawnDetached({ command, cwd, env })` for work that must continue
after Prompt Studio shuts down. It returns the child PID, starts an independent
process group, disconnects standard input/output/error, and releases the host's
process reference. The child survives both desktop Quit and `pst close`; it does
not delay runtime exit or appear as host-managed activity.

The extension owns the child's lifetime. Arrange a stop command or another
cleanup mechanism, and have the child write any required output to its own
storage. Desktop relaunch does not automatically reattach to detached work.

Use `ctx.process.run` or `runOrThrow` when the command should wait for output and
an exit code. Use the terminal API for an interactive session.

## Process Limits

The host owns every process `ctx.process.run` and `runOrThrow` start, and stops them when the
invocation that started them ends. This covers a command that returns, throws, or is cancelled.
Each command runs in its own process group, so stopping it also stops whatever it started.

- `timeoutMs` is a deadline. The host stops the child when it passes and the call throws.
- Combined standard output and standard error are capped at 8 MiB. The host stops the child and
  throws when a command passes the cap. Write large output to a file and read it back instead.
- Cancelling a command settles any `run()` it is waiting on and leaves no child process behind.
- A child still running when the command returns is stopped too, and its pending `run()` settles.

`spawnDetached` is the exception. Its children are meant to outlive the host, so the extension
owns their lifetime.

`ctx.signal` is host cancellation, not command lifetime. It aborts when the host cancels the
command, and stays open when the command simply returns, so a command can hand it to work the host
keeps running afterwards, such as a session started with `ctx.sessions.create()`.

## Commands

Commands are executable operations used by the CLI, dashboard menus, command palette, schedules, automations, and other commands.

Set `automation: true` only on commands that a scoped machine token may run. The host validates the declared params before it creates a durable automation run. Commands without this flag cannot be added to a machine token.

```ts
import { defineCommand } from "@pstdio/sdk/extensions";
import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: [
    defineCommand({
      id: "publish",
      title: "Publish release",
      description: "Create release notes and run the publish workflow.",
      cli: true,
      params: {
        version: params.text({ label: "Version" }),
      },
      async run(_ctx, commandParams) {
        return { ok: true, version: commandParams.version };
      },
    }),
  ],
});
```

Use `params.template({ type: "ticket" })` when a command selects a template. The dashboard lists templates from the
matching extension-owned template type and renders a dropdown. Use `params.resource({ resourceType: "workspace" })`
for project resources. The dashboard lists registered resources of that type and passes the selected `{ type, id }`
reference to the command.

Use `params.workspace({ providers: ["pstdio.worktree"] })` when a command creates a workspace. The dashboard shows
the same fields as **Create workspace**: a workspace type, then that provider's parameters, such as **Base branch** for
a Git worktree. The command receives `{ providerId, params }` and passes it to `ctx.workspaces.create`. Leave out
`providers` to offer every workspace type. On the CLI, pass the value as JSON:
`--workspace '{"providerId":"pstdio.worktree","params":{"base":"main"}}'`. `harness` and `resource` params also accept
JSON on the CLI.

## Named connections

Extensions declare remote HTTP access by name. The host stores the base URL and credential. Extension code receives request and stream methods, never the secret value.

```ts
import { defineConnection, defineExtension } from "@pstdio/sdk/extensions";

const controlPlane = defineConnection({
  id: "control-plane",
  label: "Remote control plane",
  transport: "http",
  auth: { type: "bearer" },
  allowedMethods: ["GET", "POST"],
  allowedPathPrefixes: ["/v1/workspaces", "/v1/sessions"],
  check: { method: "GET", path: "/v1/workspaces/health" },
  supportsStreaming: true,
});

export default defineExtension({
  connections: [controlPlane],
  commands: [
    {
      id: "remote-status",
      ref: { kind: "command", id: "remote-status" },
      title: "Read remote status",
      async run(ctx) {
        return ctx.connections.request("control-plane", {
          method: "GET",
          path: "/v1/workspaces/current",
        });
      },
    },
  ],
});
```

Connection requests must use a relative path. The host rejects undeclared methods, paths outside the declared prefixes, cross-origin redirects, oversized bodies, and non-HTTPS URLs outside loopback development. It replaces caller authentication with the stored credential. A declared `check` gives the settings UI, SDK, and `pst connections check` a fixed safe health probe.

Harnesses that can use a remote execution target set `cwdRequirement: "optional"`. Their start, resume, reattach, and message inputs receive `workspace.executionTarget`. A remote target contains the provider id and its opaque provider reference. It does not contain a local path.

Command outcomes must be transport-safe:

```ts
type CommandOutcome<T = unknown> =
  | { ok: true; status: "success"; value: T }
  | { ok: false; status: "rejected"; code?: string; reason: string }
  | {
      ok: false;
      status: "error";
      code?: string;
      reason: string;
      error?: SerializedError;
    };
```

## Middlewares And Hooks

Middleware attaches to a command and runs before the command handler. Use it for gates and command-shaping logic: validation, default params, context normalization, and rejections with user-facing reasons.

```ts
import { commandRef, defineExtension, defineMiddleware } from "@pstdio/sdk/extensions";
const createTicket = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-planner" })<{ title?: string }>(
  "create-ticket",
);
export default defineExtension({
  middlewares: [
    defineMiddleware<{ title?: string }>({
      id: "require-title",
      command: createTicket,
      async run(ctx, commandParams) {
        if (!commandParams.title) {
          return ctx.commands.reject({
            code: "missing_title",
            reason: "Title is required",
          });
        }
      },
    }),
  ],
});
```

Middleware may return `ctx.commands.continue()`, `patchParams()`, `replaceParams()`, `replaceInvocation()`, or `reject()`. Returning nothing is treated as continue.

Hooks observe emitted events. Use them for follow-up automation after something has happened: status sync, worktree cleanup, session creation, notifications, activity records, or command lifecycle reactions. Hooks cannot mutate or veto the operation that emitted the event.

```ts
import { defineExtension, defineHook, sessionEvents } from "@pstdio/sdk/extensions";
export default defineExtension({
  hooks: [
    defineHook<{ sessionId: string }>({
      id: "record-started-session",
      event: sessionEvents.started,
      async run(ctx, event) {
        await ctx.storage.set("lastSessionId", event.sessionId);
      },
    }),
  ],
});
```

Prefer exported event refs such as `sessionEvents.started` and
`workspaceEvents.created`, `workspaceEvents.ready`, and `worktreeEvents.removed`.
The host awaits `workspaceEvents.provision` handlers before marking a local workspace ready.
Planner ticket automation should use planner commands
or command lifecycle events, not removed core ticket/attempt-status events. Use
`commandEvent(providerCommands.someCommand, "completed")` or another command lifecycle phase
when a hook should react to a command outcome.

## Workspace Cleanup

`ctx.workspaces.removeWorktree(id)` removes the local worktree and branch but preserves the workspace record. `ctx.workspaces.delete(id)` performs the full provider cleanup and deletes the workspace. Both operations emit `worktree.removed` when they remove a local worktree.

## Diagnostics

Diagnostics should include the extension id when known, the source path, and project/repo context where relevant. If the entry module fails to import, the package still loads with empty contributions and an `extension_import_failed` diagnostic so the dashboard can show the package identity and error.

Warnings are actionable even when the extension still loads. For example, `extension_icon_unknown` means a contribution named an icon the host does not ship; the contribution loads, but the dashboard shows a fallback icon. Composition errors such as `invalid_placement` (a placement has an invalid shape) and `invalid_page_slot` (a page slot has an invalid shape) drop the invalid contribution and keep the rest of the extension loading. Invalid declarations report the extension, contribution, field path, and expected contract. Nested unknown fields are rejected.

## Migrating to extension API alpha.12

Native-history harnesses must implement `recoverMessages(ctx, { knownMessages, nativeMessages, cwd, workspace })`. Return `{ kind: "recovered", messages }`. Returning `{ kind: "conflict", category }` makes the host continue from the saved conversation, so prefer the saved side inside a harness instead of returning a conflict. A failed native read must throw; returning `[]` declares a successful empty history. Use the SDK's pure ordered-history helpers and keep provider-specific comparisons in the harness.

Every harness event sink now provides `getMessages()`. Full-snapshot providers must read it after asynchronous polling and compose any harness-generated metadata before synchronously publishing the replacement. Root replacements remain authoritative. When a snapshot cannot be composed safely, a provider must leave the readable messages unchanged.

Renderer read callbacks receive an AbortSignal. Forward it through command execution and all child I/O, and do not resolve a load before its children settle. Native renderers declare their refresh dependencies explicitly with extension events and the public `viewDataEvents` references. The host no longer reloads every extension view on unrelated sync changes.

## Migrating to extension API alpha.14

Navigation and resource removal use explicit context APIs. The host no longer interprets a command's returned value as a navigation target or a deletion report. Return ordinary data to the caller.

- Call `ctx.navigation.open(target)` from commands and interaction callbacks. Table and kanban row activation callbacks return void. Navigation still uses the existing target types and dispatcher, applies only after successful UI execution, and does not affect dashboards during headless execution.
- After deleting data, call `await ctx.resources.removed(resource)`. This reports the committed removal to every connected client, independently of command success. Keep missing-resource handling and update-only writes so a stale save cannot recreate deleted data.
- Remove imports of the workbench's `toWorkbenchNavigationTargetResult` and `isExtensionNavigationTarget` aliases. Use the SDK's `isNavigationTarget` for explicit target validation and `toWorkbenchNavigationTarget` when adapting a target to the workbench.

Core extensions already use these APIs. Publish their alpha.14 compatibility declarations before releasing the alpha.14 host, in a separate extension PR. Their existing published SDK dependency provides both APIs; this cleanup does not require an unpublished SDK in extension manifests. Existing exact alpha.12 and alpha.13 declarations remain valid for those hosts.

## Workspace files and context

Command context resolves the selected project/workspace and exposes typed services. `ctx.projectFiles` addresses the project's default folder; `ctx.workspaceFiles` addresses the invocation workspace. Use `ctx.workspaces.getDefault()` when the operation explicitly needs the default workspace. Remote file access must follow the provider's declared capabilities instead of assuming a local path.

The [context types](../../../packages/pstdio-api-contracts/src/extension-kernel/types/context.ts) define the complete project, workspace, session, file, command, event, notification, activity, storage, automation, connection, and process APIs. The [SDK package guide](../../../packages/sdk/README.md) shows file scopes and authoring boundaries.

## Command-backed choices

A `select` or `multi-select` parameter can use a fixed option array or a command
that returns an array of records. Set `valueField` and `labelField` to the string
fields in those records. The command must be registered in the extension.

```ts
const locales = defineCommand({
  id: "locales",
  title: "List locales",
  params: { region: params.text() },
  run: (_ctx, { region }) => region === "us"
    ? [{ id: "en", name: "English" }]
    : [{ id: "de", name: "German" }],
});
const input = {
  region: params.text({ required: true }),
  locale: params.select({
    required: true,
    options: {
      command: locales.ref,
      valueField: "id",
      labelField: "name",
      params: { region: params.valueOf("region") },
    },
  }),
};
```

The command dialog loads choices when it opens and when a referenced sibling
parameter changes. It shows loading, retry and empty states, ignores stale
responses, and clears choices that are no longer available. Unknown sibling
fields and dependency cycles produce extension diagnostics. Dependencies must
refer to fields in the same input schema.

The dialog accepts only current choices unless `allowCustomValues: true` is
set. This validation belongs to the dialog. The command runtime does not call
option commands again. Commands must enforce their own business rules. CLI and
API callers pass explicit values as before; CLI help marks these parameters as
`command-backed` and does not load choices or prompt interactively.
