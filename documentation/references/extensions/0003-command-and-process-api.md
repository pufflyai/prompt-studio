# Commands and processes

Commands are the operations an extension offers. This page covers commands, parameters, connections, middleware, hooks, and processes.

## Durable background work

Use `ctx.automation.enqueue({ command, input, key })` for work that lasts longer than a request. Read runs with `get` and `list`, and cancel them with `cancel`. Runs are scoped to the calling extension and project. Use `ctx.process` only for work the caller awaits. See [Durable work](0007-durable-automation.md) for command flags, status events, restart behavior, and limits.

## Detached processes

Use `ctx.process.spawnDetached({ command, cwd, env, envFromHost })` for work that must continue
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

Windows cleanup reports surviving target processes when a tree cannot be stopped. Parent PIDs in
native diagnostics describe relationships; they do not identify children owned by the invocation.

`spawnDetached` is the exception. Its children are meant to outlive the host, so the extension
owns their lifetime.

## Streaming processes

On `main`, after 0.48.0 (extension API 0.5.1), `ctx.process.spawn(input)` starts a child with
writable stdin and streamed stdout and stderr. Use it for long-running tools that you talk to while
they run, such as an agent CLI or a language server. Publish the supporting host and SDK before a
separately released extension adopts it.

```ts
const child = ctx.process.spawn({ command: ["my-agent", "--stdio"], env: { MODE: "json" } });
await child.write(JSON.stringify(request) + "\n");
for await (const event of child.events()) {
  if (event.type === "stdout") handle(event.data);
  if (event.type === "exit") break;
}
```

`spawn` returns its handle at once:

- `started` settles when the child runs. It rejects with a coded error when the child cannot start.
- `exited` reports the direct child's `{ code, signal }` and never rejects. A child that never
  started reports `{ code: null, signal: null }`. `kill` and lifetime teardown own descendants
  after the direct child exits.
- `treeExited` confirms that the child and its descendants have exited and that output capture
  has finished. Unread output can keep this promise pending after `exited` when the stream hits
  its buffering limit. Read `events()` concurrently, or call `kill()` to discard unread output.
- `write(data)` writes to stdin in call order and waits for the pipe to accept the data. `end()`
  closes stdin after earlier writes; later writes reject.
- `kill(signal?)` stops the child and everything it started. On Unix the default is `SIGTERM`
  followed by forced cleanup after 500 ms. On Windows the host terminates the retained Job and
  reports the native exit code with a null signal. Once the host holds the target handle, `kill`
  resolves after confirmed cleanup. A remote stop attempt that has no confirmation after five
  seconds rejects. Call `kill` again on the same handle to retry. While a target is still opening,
  `kill` resolves at once, `started` rejects with `process_owner_closed`, and the host attempts to
  stop a late child in the background. A retired extension keeps its unconfirmed handles available
  for a later lifecycle cleanup attempt.
- `events()` yields `stdout` and `stderr` chunks as `Uint8Array` and always ends with one `exit`
  event. It has one consumer. Order is kept within each stream, but not between the two streams.
- `id` identifies the handle to your code. It is not an OS pid, and no host API accepts it. The
  backend's [worker](0002-manifest-and-installation.md#process-runtime) creates its own id.

The host keeps at most 8 MiB of unread output per child, shared by both streams. At that point it
stops reading, so the child blocks on its next write until you read more. Stopping the iteration
early does not stop the child; kill it or let its lifetime end. When the child exits by itself, its
remaining output is delivered before `exit`. A kill or an ended lifetime discards unread output and
does not wait for you to read it.

`lifetime` decides who owns the child:

- `call` (default) ends with the command, hook or schedule run that started it. In a harness, a
  child started by `start`, `resume`, `reattach` or a native command lives until cancellation or
  the turn's `done` settles. Other harness calls end their children when the call settles or is
  cancelled. A command-state watch ends its children when its release function runs.
- `extension` does not depend on the call after `spawn` returns, so a handler may return before the
  child starts. It ends when the extension is disabled or removed, its source content changes, the
  project is removed, or Prompt Studio shuts down. A rebuild that leaves the source unchanged keeps
  it. In a harness it lasts for that harness instance in the project. Workspace provider callbacks
  have no extension lifetime; their children start in the provider's process directory, as `run`
  does.

A spawn whose owner has already ended fails with `process_owner_closed` and starts nothing.

The child runs on a workspace target. Commands and hooks use their invocation's workspace; pass
`workspaceId` to choose another workspace of the same project. A harness session uses the workspace
supplied by the host. Detection and model calls without a workspace run on this device. A
workspace of another project fails with `process_target_unavailable`. `cwd` is a path on that target:
a relative `cwd` resolves against the workspace root, and a `cwd` never moves the child to another
target.

A remote workspace runs the child through its provider's `spawn` method. When the provider has
none, the call fails with `process_target_unsupported` and nothing starts on this device.
`envFromHost` is only available for local children. Each owner can have up to 256 remote processes
that are opening or awaiting confirmed cleanup. If `started` reports `process_target_unavailable`
for that limit, stop an earlier process and wait for cleanup before starting another.

The environment is the same as for `run`: the small runtime base, your `env`, and the host values
you request with `envFromHost`. The host replaces granted values with `[Redacted]` in the streamed
output, also when a value is split across chunks. A child whose grant is revoked is stopped first.

Error codes on `started`: `process_command_not_found`, `process_target_unsupported`,
`process_target_unavailable` and `process_owner_closed`.

### Remote workspace providers

A workspace type whose workspaces run elsewhere can add two optional methods:

- `spawn(ctx, { projectId, workspaceId, providerRef, process, signal })` returns a process handle
  with the same contract. `ctx` is the provider's own context. Observe `signal` to cancel opening
  the remote process if the caller stops it before the handle is returned. The host owns the
  returned handle and kills it when the caller's lifetime ends. Resolve `treeExited` when the target
  confirms the child and its descendants have exited and output capture has finished or discarded
  the remaining data. The provider's call and its local helpers stay open until that confirmation,
  a successful stop, or cancellation.
- `readText(ctx, { projectId, workspaceId, providerRef, path })` reads a UTF-8 text file on the
  target for `targetFiles.readText`. Expand `~` on the target.

### Target files

Harness contexts have `ctx.targetFiles.readText({ workspaceId, path })` for files that live with
the agent on the workspace target, such as native session history. `path` is native to the target:
`~` expands to the target's home, and a relative path resolves against the workspace root. A local
workspace reads from this device. A remote workspace reads through its provider's `readText`, or
fails with `target_file_unsupported`; the host never reads a local file instead. The workspace must
belong to the calling project. It reads with the same access as other extension file APIs and is
not a sandbox.

## Host diagnostics

On `main`, after 0.48.0 (extension API 0.5.1), `ctx.diagnostics.capture(input)` profiles the
Prompt Studio API process, which runs the host's routes and services. It also collects the
[runtime operations](0027-performance-diagnostics.md#backend-operation-instrumentation) the host
publishes during the capture, such as database queries. Extension backends run in their own
[workers](0002-manifest-and-installation.md#process-runtime), so profiling inside a handler, or
subscribing to the operation channel there, sees only that worker. Publish the supporting host and
SDK before a separately released extension adopts it.

```ts
const { summary, data } = await ctx.diagnostics.capture({ kind: "cpu", durationMs: 15_000, signal: ctx.signal });

await ctx.diagnostics.capture({
  kind: "armed",
  durationMs: 60 * 60_000,
  cpuPercent: 60,
  checkpoint: (data) => ctx.extensionFiles.writeText("spike.json", JSON.stringify(data)),
});
```

| `kind` | Records | Limit |
| --- | --- | --- |
| `cpu` | A V8 CPU profile in `data.profile`. `summary.unit` is `samples`. | `durationMs` up to 60,000 |
| `coverage` | Function-call counts in `data.coverage`. `summary.unit` is `calls`. | `durationMs` up to 60,000 |
| `armed` | Samples host CPU every 2 seconds while profiling in windows of about 30 seconds. It stops when one sample reaches `cpuPercent` (a percentage of one core, up to 10,000) or when `durationMs` passes. `data.profiles` keeps the latest two windows. | `durationMs` up to 24 hours |

- `summary` lists the 20 most frequent functions with memory before and after. `data` holds the
  complete evidence, the host pid and the operation trace: the latest 60 seconds, at most 1,000
  events and 512 KiB, with `dropped` counting the rest.
- `checkpoint(data)` runs after each armed window and at the end, so evidence survives a host that
  stops mid-capture. One write runs at a time; a newer checkpoint replaces one still waiting, and
  `data.skippedCheckpoints` counts them. The host releases the profiler and operation subscription
  when recording ends. A rejected checkpoint fails the capture. Final checkpoint writes have 30 seconds
  to finish after recording ends, then the capture rejects with `diagnostics_checkpoint_timeout`.
- Aborting `signal`, cancelling the invocation, or the invocation ending stops the profiler and
  rejects with the abort reason.
- One recording uses the host profiler at a time. An overlapping recording rejects with `diagnostics_busy`. Invalid input or a
  duration above the limit rejects with `diagnostics_invalid_input`.
- Only first-party extensions may capture: an id with the `pstdio.` publisher that is listed in
  the packaged extension catalog. It must run from the host's checkout or an adopted revision the installer
  verified from the catalog's Git release, the host's release registry, or the host's checkout. Update or
  reinstall a catalog extension whose current revision predates install verification before using this API.
  Other sources reject with `diagnostics_forbidden`. Profiles contain host source paths, call stacks and
  runtime identifiers, so keep them in extension-owned local storage.

## Host environment values

A child started with `ctx.process` gets a small set of runtime variables, such as `PATH` and
`HOME`, plus the `env` you pass. It never gets the rest of the host environment. To pass a value
the user keeps in the environment that starts Prompt Studio, such as a provider key, request it by
name:

1. List the name in `package.json` under `pstdio.processEnvironment`. See
   [Manifest and installation](0002-manifest-and-installation.md#host-environment-names).
2. Name it in `envFromHost` when you start the child:

   ```ts
   await ctx.process.run({ command: ["claude", "-p", prompt], envFromHost: ["ANTHROPIC_API_KEY"] });
   ```

`run`, `runOrThrow`, `spawnDetached` and `spawn` accept `envFromHost`. Before starting the child, the host
checks each name against the declaration and against the user's grant for this project and this
exact extension source. The call then fails, and no child starts, when:

- a name is not in `pstdio.processEnvironment` (`process_environment_not_requested`);
- the user has not allowed the name for this project, or the extension source changed since they
  did (`process_environment_not_granted`);
- the host environment does not have the variable (`process_environment_unavailable`);
- `env` also sets the name. `env` cannot replace a value requested with `envFromHost`.

Processes the host starts for a harness or a workspace provider in a project, such as an
availability check or a model list, get the names the user allowed for that extension and source in
that project without asking. A name the host environment does not have is left out. Outside a
project, for example at startup, they get none.

The value goes into the child's environment, and no `ctx` API returns it. The backend's own
`process.env` is a separate matter: the worker receives the host environment without reserved names,
so a provider key that starts Prompt Studio is visible there too. See
[Process runtime](0002-manifest-and-installation.md#process-runtime). The host replaces it
with `[Redacted]` in the child's `stdout` and `stderr` before returning them. That only prevents
accidental output: the extension chooses the command, so it can still pass the value on. Allowing a
name lets the extension use its value. When the user revokes the grant or narrows it, the host first stops the running children that
received it, including detached ones, and then retires the grant. A detached child that outlived a
host restart is not stopped by a later revocation.

`ctx.signal` is host cancellation, not command lifetime. It aborts when the host cancels the
command, and stays open when the command simply returns, so a command can hand it to work the host
keeps running afterwards, such as a session started with `ctx.sessions.create()`.

## Host load limits

The host shares one database and one API process among the workbench, core and every extension.
It keeps them responsive when an extension does a lot of work at once.

- Database work started by your handler code belongs to your extension. That covers commands,
  middleware, private handlers, hooks and workspace provider callbacks. Work the host does around
  them, and calls from extension webviews to host routes, is core work. Core work goes ahead of
  queued extension work. When both keep queuing, extensions still get one turn for every four core
  turns. Extensions take turns with each other, so one extension's queue does not delay another's.
  Your own calls keep their order, and a transaction runs as one unit.
- Before extension work runs, the host lets the event loop take a turn once about 10 ms of
  continuous database work has passed. Health checks, cancellation and other requests are answered
  during an extension's long burst. A single long statement or transaction is not split, so keep
  transactions short.
- One extension can run at most 256 commands at once, across all projects. A command's nested
  `ctx.commands.execute` calls to the same extension share its place while the original command
  is active. Deferred work after the command finishes or is cancelled needs a new place, as do
  hooks outside an active command of that extension. A new command over the limit returns
  `{ ok: false, status: "rejected", code: "extension_overloaded" }` before its handler starts, so it
  made no changes. Its diagnostic gives `metadata.retryAfterMs` as a hint for callers that retry. The
  host does not retry it for you. A cancelled command frees its place even if its handler ignores
  `ctx.signal`.

These limits apply to database work. Extension code still runs in the API process, so synchronous
CPU work, such as a long loop, still blocks the host until the backend process boundary in ADR 0058
ships. Use bounded batches instead of `Promise.all` over hundreds of storage calls.

## Commands

Commands are executable operations used by the CLI, dashboard menus, command palette, schedules, automations, and other commands.

Set `automation: true` only on commands that a scoped machine token may run. The host validates the declared params before it creates a durable automation run. Commands without this flag cannot be added to a machine token.

On `main`, a command can set `copyResultToClipboard: true` to copy its successful text result when invoked from the dashboard. Return a string from `run`; other result types show an action error. The host starts the clipboard write during menu selection, before waiting for the command. Clipboard permission failures use the action's normal error surface. CLI and API calls return the text without changing a clipboard. This additive option shares the planned extension API 0.4.0 release; publish its SDK and host before extensions adopt it.

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
for project resources. A command with one required resource parameter opens the native, virtualized
resource search. It combines registered resources with matching `commandPaletteResources` providers,
refreshes from their declared events, and preserves the complete selected reference (including owner,
project and device) as the command argument. Selection executes the original command in its captured
viewer context, rather than activating the provider's ordinary navigation target. Other forms keep
resource fields beside their remaining parameters. Providers may page their public data to honor the
requested aggregate `limit`; More resources retains the current query and focus.

Use `params.workspace({ providers: ["pstdio.worktree"] })` when a command creates a workspace. The dashboard shows
the same fields as **Create workspace**: a workspace type, then that provider's parameters, such as **Base branch** for
a Git worktree. The command receives `{ providerId, params }` and passes it to `ctx.workspaces.create`. Leave out
`providers` to offer every workspace type. On the CLI, pass the value as JSON:
`--workspace '{"providerId":"pstdio.worktree","params":{"base":"main"}}'`. `harness` and `resource` params also accept
JSON on the CLI.

## CLI contributions

Set `cli: true` to expose a command as `pst <publisher>.<name> <command-id>`. Dots in the local command ID become path segments: extension `acme.bookmarks` and ID `links.add` produce `pst acme.bookmarks links add`. Installing and enabling the extension makes its CLI paths available in that project.

Use a CLI contribution object to choose the path inside the owning extension namespace or add examples:

```ts
cli: {
  path: ["links", "add"],
  examples: ['pst acme.bookmarks links add --title "Prompt Studio" --url https://prompt.studio'],
},
```

`path` is relative to the full extension ID. Extensions cannot register global shortcuts or claim another provider's namespace. The extension API 0.5.0 release removes `globalAliases`; remove that field and update command examples to use the qualified namespace. Host-managed deprecated namespace paths remain available during identity upgrades. `cli: true` does not by itself add a palette entry or toolbar action; declare those separately and point them to the same command.

### Help and parameter flags

Run `pst --help` inside a linked project folder to list its enabled extension namespaces. The runtime must be reachable; otherwise, top-level help shows only core commands. `pst <namespace> --help` lists CLI paths, and command help shows the provider, command ID, options, aliases, and examples. Namespace and command calls can target another project with `--project-id <project-id>`.

Parameter names become flags in kebab-case: `noteId` becomes `--note-id`. The shared declarations define both the command's inputs and the dashboard form fields.

| Parameter type | CLI input |
| --- | --- |
| Text, select, template | `--title "Meeting notes"` or another scalar value |
| Number | `--count 3` |
| Boolean | `--archived` for true, `--archived=false` for false |
| List | Repeat the flag: `--tag docs --tag release` |
| JSON, harness, resource, workspace | Pass quoted JSON, such as `--workspace '{"providerId":"pstdio.worktree","params":{"base":"main"}}'` |

Missing required flags are rejected before execution. The host validates command parameters and runs the command middleware for the invocation.

### Results and agent access

Without `--json`, success prints the command's returned value as JSON. With `--json`, the CLI prints the full execution response. Check `outcome.ok` before reading `outcome.value`. Failure or rejection exits with code 1.

Return IDs and relevant state from mutating commands, and expose read or list commands when callers need to check the result. An agent can then discover an operation, run it, inspect its response, and continue without scraping the dashboard.

`cli: true` is local CLI exposure. `automation: true` is separate: it lets that exact command be granted to a scoped machine token for remote automation. Neither flag grants unrestricted access to every command. See [Remote automation](../cli/0007-automation.md).

## Named connections

Extensions declare remote HTTP and MCP access by name. The host holds credentials and applies the declared request or tool policy. Commands receive data through `ctx.connections`.

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

Connections use project scope by default. Set `scope: "global"` in `defineConnection`
to share one connection and credential across local projects on the same device.
Configure, check, or revoke it through any project that enables the extension.
New projects can use the existing global connection. Global connection metadata
and credentials stay on the host and are not included in project sync or shared
extension packages. Removing a project does not remove a global connection.

### Browser sign-in for OAuth

Use `auth.type: "oauth"` for a project connection that needs provider consent.
REST connections keep their method and path allowlists. Declare `auth.baseUrl`,
`auth.authorizationEndpoint`, `auth.tokenEndpoint`, and the public OAuth
`auth.clientId` registered with the provider. Add `auth.scopes` and
`auth.revocationEndpoint` as needed. For a path-scoped issuer, declare `auth.issuer`. Register the callback
`/v1/extension-connections/oauth/callback` on the host origin with the provider.
Use an HTTPS host origin or a loopback HTTP origin for local development.

A Streamable HTTP MCP connection declares its resource URL and exact tool names.

```ts
import { defineConnection } from "@pstdio/sdk/extensions";

const crm = defineConnection({
  id: "crm",
  label: "CRM",
  transport: "mcp",
  auth: { type: "oauth", resourceUrl: "https://crm.example.com/mcp" },
  allowedTools: ["read_accounts", "read_agreements"],
});
```

Add this declaration to `defineExtension({ connections: [...] })`. The host
discovers the MCP resource and authorization server metadata and registers an
OAuth client with the provider. The token request is bound to the MCP resource.
Call `ctx.connections.callTool("crm", { name: "read_accounts", arguments: { cursor } })`
from a command or schedule. The call returns the MCP tool result without a model turn.
HTTPS endpoints must stay on HTTPS throughout discovery. Resource metadata is read
on the declared MCP origin. If the authorization server has a separate origin,
declare that exact origin in `auth.authorizationServerOrigin`. Discovered OAuth
endpoints must use the trusted authorization server origin. OAuth and resource
requests never follow redirects.

The host SDK exposes management on `client.extensions`:

- `startConnectionOAuth(projectId, extensionId, connectionId)` returns an
  `authorizationUrl` to open in the browser. Provider consent returns the browser
  to the callback. A new sign-in replaces any pending attempt for the same owner.
- `connectionOAuthStatus(projectId, extensionId, connectionId)` returns
  `disconnected`, `authorizing`, `connected`, or `reconnect_required`.
  Commands read the same typed state with `ctx.connections.oauthStatus(connectionId)`.
  The connected status contains the granted scopes, expiry if known, and an opaque
  `grantId`. Scope cached data to this grant ID. Check it before and after the read
  and store the result only if the grant is still connected and its ID matches.
- `disconnectConnectionOAuth(projectId, extensionId, connectionId)` discards pending
  authorization and the current owner's local grant. It also requests provider
  revocation when the provider advertises or declares that endpoint.

Grants belong to the project, extension, connection and active Prompt Studio
account on the executing host. A local host without an account uses its local
principal. A scheduled command on that host can use the same owner's grant
after restart. The host refreshes on demand and retains rotated credentials.
When consent is revoked or the grant cannot be renewed, sign in again.
Tokens and registered client secrets stay behind the host connection secret
store. See [RB 5.A.7](../../requirement-book/book.json) and
[ADR 0034](../../adrs/0034-temporary-file-connection-secret-store.md) for the
default storage's deployment limits.

Harnesses that can use a remote execution target set `cwdRequirement: "optional"`. Their start, resume, reattach, and message inputs receive `workspace.executionTarget`. A remote target contains the provider id and its opaque provider reference. It does not contain a local path.

Command outcomes are a validated union. `ok: true` requires `status: "success"`; rejection and
error outcomes have `ok: false`. Both failure variants carry `code?`, `reason`, `data?`, `cause?`,
`error?`, `diagnostics?` and `notices?`. Serialized errors keep nested causes. Notices and diagnostics
also apply to successful outcomes. The kernel, HTTP and webview use this same contract.

A recoverable rejection, such as `stale_revision`, keeps its data on every path. Commands inspect
`ctx.commands.execute(...).status`. The SDK HTTP client returns `{ commandId, extensionId, outcome }`.
Webview `client.commands` returns the value or throws `CommandOutcomeError`; read its `outcome`
for the complete rejection. `getCommandValue(outcome)` provides the same throwing behavior.

In 0.44, `unwrapCommandOutcome` is deprecated; use `getCommandValue` or check the outcome explicitly.
The SDK `execute` result retains the old optional fields for source compatibility during that
release. New code narrows `outcome.ok` or `outcome.status` before reading variant-specific fields.

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
The core host emits no ticket events. Tickets belong to the Planner extension, so ticket automation
uses Planner's commands or their lifecycle events. Use
`commandEvent(providerCommands.someCommand, "completed")` or another command lifecycle phase
when a hook should react to a command outcome.

## Workspace Cleanup

Session readers return `ExtensionSession`: `workspaceId`, `lastSelectedModel`, `originalSessionId`,
`createdAt`, `updatedAt`, `lastRequestStarted` and `lastRequestEnded` use camelCase.
`cwd` is the execution directory or null. `get` also returns `lastExit`.
Usage totals use `inputTokens`, `outputTokens`, `cacheReadTokens` and `cacheWriteTokens`.
The SDK client returns the same fields. Snake-case fields remain deprecated through 0.44.

Workspace readers return `ExtensionWorkspace` with `projectId`, `shorthand`, `rootPath`,
`providerId`, `providerState`, `executionKind`, `displayPath`, `capabilities`, `isDefault`,
`setupError`, `createdAt` and `updatedAt`. Create one with
`ctx.workspaces.create({ providerId: "pstdio.worktree", shorthandBase: "WS", params: { base: "main" } })`.
Creation may attach anchors; read existing links through `ctx.resources`.

`ctx.workspaces.removeWorktree(id)` removes the local worktree and branch but preserves the workspace record. `ctx.workspaces.delete(id)` performs the full provider cleanup and deletes the workspace. Both operations emit `worktree.removed` when they remove a local worktree.

## Diagnostics

Diagnostics should include the extension id when known, the source path, and project/repo context where relevant. If the entry module fails to import, the package still loads with empty contributions and an `extension_import_failed` diagnostic so the dashboard can show the package identity and error.

Warnings are actionable even when the extension still loads. For example, `extension_icon_unknown` means a contribution named an icon the host does not ship; the contribution loads, but the dashboard shows a fallback icon. Composition errors such as `invalid_placement` (a placement has an invalid shape) and `invalid_page_slot` (a page slot has an invalid shape) drop the invalid contribution and keep the rest of the extension loading. Invalid declarations report the extension, contribution, field path, and expected contract. Nested unknown fields are rejected.

## Workspace files and context

Command context resolves the selected project/workspace and exposes typed services. `ctx.projectFiles` addresses the project's default folder; `ctx.workspaceFiles` addresses the invocation workspace. Use `ctx.workspaces.getDefault()` when the operation explicitly needs the default workspace. Remote file access must follow the provider's declared capabilities instead of assuming a local path.

The [context types](../../../packages/pstdio-api-contracts/src/extension-kernel/types/context.ts) define the complete project, workspace, session, file, command, event, notification, activity, storage, automation, connection, and process APIs. The [SDK package guide](../../../packages/sdk/README.md) shows file scopes and authoring boundaries.

### File access

`ctx.projectFiles`, `ctx.workspaceFiles`, and `ctx.extensionFiles` are file mounts (`ArtifactMount`). Paths are relative to the mount root and cannot leave it. `ctx.packageFiles` is a read-only mount of the installed package. All four are in 0.43.x and `main`.

| Method | What it does |
| --- | --- |
| `exists(path)` | Returns whether a file or folder exists. |
| `readText(path)`, `readBytes(path)` | Reads a file as UTF-8 text or as bytes. |
| `writeText(path, value)`, `writeBytes(path, value)` | Creates or replaces a file. Not on `ctx.packageFiles`. |
| `updateText(path, value)` | Replaces only an existing file. It fails when the file is missing and never recreates a deleted file. Not on `ctx.packageFiles`. |
| `list(pattern?)` | Lists files in all subfolders, optionally filtered by a glob pattern. |
| `listDirs(path?)` | Lists the folders directly inside `path`, or inside the root. |
| `delete(path)` | Deletes a file, or a folder with its contents. Not on `ctx.packageFiles`. |

- `ctx.projectFiles.exists`, `readText`, `writeText`, `updateText`, `readBytes`, `writeBytes`, `list`, `listDirs`, and `delete` act on the project's default folder.
- `ctx.workspaceFiles.exists`, `readText`, `writeText`, `updateText`, `readBytes`, `writeBytes`, `list`, `listDirs`, and `delete` act on the invocation workspace. `ctx.workspaceFiles.syncDir` is described below.
- `ctx.packageFiles.exists`, `readText`, `readBytes`, `list`, and `listDirs` read the installed extension package.
- `ctx.extensionFiles.exists`, `readText`, `writeText`, `updateText`, `readBytes`, `writeBytes`, `list`, `listDirs`, and `delete` act on the extension's allocated folder. See [Webviews and storage](0005-webview-and-storage-api.md#package-assets) for its location in each release.

`ctx.files` works with project files by file ID, such as uploaded attachments. `ctx.files.readText(fileId)` reads one. `ctx.files.writeText(fileId, value)` replaces the content of an existing file in this project. `ctx.files.createText({ name, content, metadata? })` creates a text file and returns `{ id }`. `ctx.files.delete(fileId)` deletes one.

### Other context services

The table includes established services and the unreleased workspace presentation methods noted below:

| Method | What it does |
| --- | --- |
| `ctx.resources.allocate({ kind })` | Allocates the next short ID for a resource kind that declares a `prefix`, such as `PS-12`. Returns `{ id, shorthand }`. The `WS` prefix is reserved for workspaces. |
| `ctx.sessions.addAnchors(sessionId, anchors)` | Links a session to resources. |
| `ctx.sessions.removeAnchors(sessionId, refs)` | Removes those links. |
| `ctx.workspaces.get(id)` | Returns a workspace in this project, or `null`. |
| `ctx.workspaces.rename(id, { name })` | Renames a local workspace record in this project. Its ID, shorthand and path stay the same. Default workspace names cannot change. |
| `ctx.workspaces.listFiles(id, { path?, query?, limit? })` | Lists direct children, or finds entries recursively when `query` is supplied. The default and maximum limit is 500; `truncated` reports more matches. |
| `ctx.workspaces.readFile(id, path)` | Reads supported text or an image preview. `editable` reflects both the format and the provider's file permissions. |
| `ctx.workspaces.createDirectory(id, path)` / `createFile(id, path, { content })` | Creates a folder or text file without replacing an existing entry. |
| `ctx.workspaces.writeFile(id, path, { content })` | Saves an existing supported text file; missing files are not recreated. |
| `ctx.workspaces.moveEntry(id, path, destinationPath)` / `deleteEntry(id, path)` | Moves, renames or deletes an entry inside the workspace. An already existing destination is rejected before the move. |
| `ctx.workspaces.diffFiles(id, mode)` | Returns lightweight changed-file metadata and counts without file bodies. |
| `ctx.workspaces.diffFile(id, mode, path)` | Loads one changed file body, or `null` when the file has no change in this comparison. |
| `ctx.workspaces.diffSummary(id, mode)` | Returns additions, deletions and changed-file count. |
| `ctx.workspaces.addAnchors(workspaceId, anchors)` | Links a workspace to resources. |
| `ctx.workspaces.removeAnchors(workspaceId, refs)` | Removes those links. |
| `ctx.workspaces.resolve(id)` | Returns the provider state, execution kind, execution target, capabilities, and any provider error. |
| `ctx.workspaces.cancel(id)` | Cancels a workspace that is still being created and returns it. A workspace in any other state is returned unchanged. |
| `ctx.net.findFreePort({ host? })` | Returns a free TCP port on `host`, `127.0.0.1` by default. |
| `ctx.connections.stream(connectionId, request)` | Sends a request through a named connection and yields `response`, `data`, and `end` events. See [Named connections](#named-connections). |
| `ctx.logger.info`, `ctx.logger.warn`, `ctx.logger.error` | Write `(message, metadata?)` to the runtime log with event `extension.log`. The default log level, `error`, drops `info` and `warn`. |
| `ctx.settings.delete(key)` | Removes the stored value of a setting. |

The workspace presentation methods in the table are **unreleased**, added after 0.46.0 on
the API 0.3.1 line. Publish the supporting host and SDK before adopting them in a
separately released extension. They use the command's project and cancellation
scope. File operations require a ready local file target and enforce the provider's
read/write capabilities, path containment and Git metadata restrictions. They do
not forward operations to another device's private history. Use the existing
project/workspace file mounts when resolving a native text source.

Diff operations require a ready local provider with `diff` enabled. The mode is
`"current"` for uncommitted changes against HEAD or `"fork_point"` for all changes
since branch creation. Git comparisons use the provider's worktree root, including
when execution starts in a subfolder. Invalid, missing or unavailable workspace
targets reject; `diffFile` returns `null` only for an unchanged or missing diff
entry. Moves use the existing host rename operation; a concurrent writer changing
the destination is not an exclusive transaction. Working-tree symlink bodies show the target text without reading the target file.

On `main`, `ctx.resources.allocate({ kind, idPrefix: "tk" })` opts into a compact,
case-sensitive ID while keeping the human shorthand unchanged. This additive option
ships in the release after 0.44.0. It shares the core generator with
`ctx.storage.ids.create("tk")`; omitting `idPrefix` keeps UUID output. See
[Resource identities](../sdk/0002-resources.md#resource-identities).

### Cloud account and sync status

On `main`, `ctx.account.status().loginAttempt` and the webview account client expose
the native device owner's latest sign-in request ID and `pending`, `complete` or
`failed` status. No URL or credential is included. Listen to `accountEvents.changed`
for start, completion, cancellation and expiry. A new sign-in replaces and drains
the previous pending callback; sign-out closes it too. Different projects and
extension copies observe the same operation. Do not persist another sign-in request
in extension settings. Production consumers need a compatible published host and SDK.

On `main`, `ctx.account` reads this device's Cloud account, the account's devices, and each project's sync status. It is an additive part of extension API 0.2.1 and ships in the release after 0.44.0. The native host owns the device credential; extensions never see it. Methods that take a `projectId` use the current project when it is omitted.

| Method | What it does |
| --- | --- |
| `ctx.account.status()` | Returns `{ login, cloudProjects, cloudProjectsLoaded, features, signInRequired? }`. `login` is `null` when this device is signed out; otherwise it has the account and device IDs, the service addresses, and a verified `email` when available. `cloudProjectsLoaded` stays `false` until the account service answered for this login. `signInRequired` is true after this device credential was rejected. |
| `ctx.account.login(managerOrigin?, provider?)` | Starts a native browser sign-in with Google by default. Pass `"microsoft"` to choose Microsoft. Uses the configured account service unless given an explicit address and returns `{ id, url }`. Open `url` in a browser on the computer that runs Prompt Studio. |
| `ctx.account.loginStatus(id)` | Returns `pending`, `complete`, or `failed`. |
| `ctx.account.cancelLogin(id)` | Cancels a pending sign-in and returns `failed`. A sign-in that already finished returns `complete`. |
| `ctx.account.logout()` | Signs this device out and keeps local data. Returns `{ removed }`; `removed` is `false` when the account service could not be reached. |
| `ctx.account.devices()` | Lists the account's devices with `name`, `platform`, `lastSeenAt`, `online`, and `current` for this device. |
| `ctx.account.renameDevice(id, name)` | Renames a device. |
| `ctx.account.removeDevice(id)` | Stops a device from renewing Cloud access. Removing the current device signs it out. |
| `ctx.account.projectSyncStatus(projectId?)` | Returns `{ state, offlineReady, pendingItems?, download?, sources?, away?, replaced? }` for a project. |
| `ctx.account.retryProjectSyncSource(sourceId, projectId?)` | Cancels and drains one source, then retries it without restarting other sources. |
| `ctx.account.syncProject(projectId?)` | Syncs the project on every device of the account that has it. |
| `ctx.account.stopProjectSync(projectId?)` | Makes the project local on every device. |
| `ctx.account.resolveReturnedChanges(action, projectId?)` | `apply` uploads changes held for review on this device, `discard` drops them and takes Cloud's copy, `dismiss` clears the replaced-changes list in `projectSyncStatus().replaced`. |

`state` is one of these values. The host derives it on each read from the local documents, the record assets and the relay connections. It never stores a second status.

| `state` | Meaning |
| --- | --- |
| `local` | The project does not sync. |
| `waiting-to-sync` | Saved local changes have not reached Cloud yet, or a sync run is still working. |
| `synced` | Every known document and required file is on this device, and saved changes have reached Cloud. |
| `offline` | The Cloud connection is lost, or the account service has not confirmed which projects sync. Work continues locally. |
| `first-download-incomplete` | The first download since the relay connection started has not finished, so some documents or files may not be on this device yet. |
| `needs-attention` | Some encrypted data could not be read or a source requires manual attention. Healthy sources continue. |

`offlineReady` is `true` only when every known document and required file was verified on this device. The host never reports `synced` or `offlineReady` while content is missing. An incomplete first download stays `first-download-incomplete` when the connection drops. Later downloads, such as catching up after a reconnect, report `waiting-to-sync` with `offlineReady` set to `false` until they finish. The first download starts again when the runtime restarts or a project starts syncing again.

Stopping and restarting sync are account-wide. Stopping keeps the project keys, the encrypted Cloud data, and each device's local copy. Edits made on several devices while the project is local merge when it syncs again.

`pendingItems` counts distinct sync documents with unacknowledged local changes. Each owner metadata document, text document, and record stream is one item. This includes core project info and resource numbers, extension publications, automations, enabled extensions, and personal history with its shared references and transcripts. Several record edits in one stream count as one item, not one item per record. A retry does not add another item. The count is absent while an owner or its directory is not known, including personal changes awaiting capture by the sync worker. It can be zero while the transport finishes a sync pass.

`download` reports `{ completed, total }` in the same document units. A document counts as completed only after its required files are verified too. `total` is `null` while any owner directory is unknown. Once known, `Math.floor(100 * completed / total)` gives the percentage for a nonzero total. Newly discovered documents can increase the total, and reconnects can restart verification. This is verified-document progress, not bytes transferred. The fields are optional additions to API 0.3.1; older hosts omit them. Status reads use document revision metadata and indexed outbox presence, without loading owner or record content or listing every record.

Listen to `accountEvents.projectSyncChanged` from `@pstdio/sdk/extensions` for changes. The host sends it for one project only when any derived status field changes, including progress while the state stays the same. Read the status once when the extension starts; the first value is not announced. The payload contains `projectId` and the status fields. Webviews receive only the event ID, so read the status again.

On `main`, `sources` adds independent source IDs, display names, connection and busy flags,
the real pending `phase`, `phaseStartedAt`, `lastProgressAt`, completed document counts,
and recent `files`. `startedAt` and `completedAt` retain elapsed time after a pass.
Files expose available metadata names, direction, queued/active/completed/failed status,
original `byteLength` and encrypted `completedBytes`/`totalBytes`. Internal records have
no invented file names. Recent terminal file entries are bounded to 50 per source;
active and queued entries are retained. This is transient local activity, not a durable history.
Retryable request failures appear in each source's `error`; they do not replace the
aggregate initial-download or connection state.

When `canRetry` is true, call `retryProjectSyncSource(source.id, projectId)` to cancel
that source and await its running work before retry. Durable cursors, operation IDs,
local edits and staged file bytes are preserved. No shared socket is restarted.
The webview operation uses `account.manage`. HTTP clients use
`POST /v1/account/projects/{id}/sync/sources/{sourceId}/retry`, or
`client.account.retryProjectSyncSource(projectId, sourceId)`. Unknown sources fail.
These additive API 0.4.1 changes require a matching published SDK and host.

`signInRequired` distinguishes a rejected device credential from an ordinary sign-out. It survives a host restart and clears after successful sign-in or explicit sign-out. Network loss, scheduled relay-token renewal, a removed project, and lack of early access do not set it. Local project data stays on this device. Listen to `accountEvents.changed` for changes to the public account status, even when project sync state stays the same. Its payload is `AccountStatus`; webviews receive the event ID and read `account.status()` again. Read once on startup because the first value is not announced.

Account service failures reach the extension as a generic message, so private service details stay in the host. Device presence comes from the account service: a signed-in runtime sends a heartbeat every 15 seconds, and `online` means the service heard from the device within the last 45 seconds.

### Agent skill folders

Harness extensions call `ctx.workspaceFiles.syncDir(dir, files)` during workspace setup to copy the skill catalog into an agent folder such as `.claude/skills`. The host records each file it writes, with a hash of its content, outside the workspace. A later sync updates or removes a file only while it still has the recorded content. It adopts an existing file that already has the wanted content. It keeps a file it did not write or that someone edited, and logs a warning with event `extension.workspace_sync.kept_file`. The host log (`logs.jsonl` in the Prompt Studio home folder) records warnings when `PSTDIO_LOG_LEVEL` is `warn`, `info`, or `debug`. The default level, `error`, does not. Deleting a kept file lets the next sync write the current version. `syncDir` does not report kept files to the extension.

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

A sibling with `resolvedFrom: "resource"` stays hidden in the dialog, but
`params.valueOf` can still reference it. Choices and submission use the same
value: an explicit action argument takes priority over the active resource.
Opening the dialog for another resource loads choices for that resource.
Dashboard commands also resolve these hidden values before dispatch when no
parameter form is needed. Explicit action arguments still take priority.

Workspace provider `params` support the same command-backed choices in Create
workspace and in nested `workspace` command fields. Changing the provider cancels
its pending option requests. Changing an instance refreshes its dependent
templates, and submission waits for the current choices.

The dialog accepts only current choices unless `allowCustomValues: true` is
set. This validation belongs to the dialog. The command runtime does not call
option commands again. Commands must enforce their own business rules. CLI and
API callers pass explicit values as before; CLI help marks these parameters as
`command-backed` and does not load choices or prompt interactively.

Workspace providers must validate instance and template ownership in `create`.
Choice lists help discovery; they do not authorize a resource. The host still
checks required fields, value types, fixed choices, and provider availability.
Harness params and Kanban create-row forms require fixed options.
Fixed choices keep their string `label` fallback and can add `localizedLabel: l10n("stable.key", "Default copy")`. The dashboard translates the display label while option values stay unchanged across locales.

## Local workspace providers on main

These additions share API 0.4.0 on `main`, after 0.46.0. Publish the supporting
host and SDK before a separately released extension adopts them. SDK 0.46.0 does
not contain them.

`defineWorkspaceType` accepts an optional `discover(ctx)` callback. Return
`{ params }` to supply this project's current creation fields, choices and
defaults. Return `null` when the provider is unavailable. Omit the callback to
keep the static `params` schema; omit `params` from a discovery result to reuse
that schema. Discovery runs when providers are listed and before a new create is accepted.
The host persists validated parameters before allocation; accepted operations
replay those parameters without rediscovering choices or applying new defaults. Do not cache project-dependent choices in module state.
A failed discovery hides that provider from the current list and logs the error;
other providers remain available. Creation validates the discovered schema and
providers must still enforce their own resource ownership rules. Command-backed
choice references are qualified to the provider and checked against installed
commands, sibling fields and dependency cycles, just like static schemas.

Use optional `validateParams(ctx, params)` for provider-specific checks, such as
whether a revision exists. It receives schema-validated values with defaults
applied. Throw a useful error to reject creation before the host saves a workspace.
It runs in project context, without an allocated workspace directory. Keep it
read-only; allocate resources in `create` after the host owns their identity.
This preflight runs only before initial allocation. `create` and `resolve` must
still check backing-resource invariants when the environment changes afterward.

The default Workspaces extension uses these public provider callbacks and
`ctx.process` for Git operations. The host's existing `pstdio.worktree` identity
routes to its installed workspace type, including stored legacy references.
Backing references remain provider-owned JSON. Disabling the extension retains
the workspace and files; enabling it again resolves that same reference. Core
continues to protect the default folder and cancel sessions before deletion.

During workspace-bound provider callbacks, the optional `ctx.localDirectory()`
allocates or reopens a host-managed local directory owned by that provider,
project and workspace. It is available before the workspace is ready and returns
`{ path, files, remove }`. `files` is an `ArtifactMount`; use `path` as the explicit
`cwd` for a local process. The same workspace reopens the same directory after a
restart. `remove()` deletes that directory, retaining the workspace record and
history. The host rejects default workspaces, another provider's or project's
workspace, and paths resolving outside the workspace's own managed directory.
The method is absent in project-only discovery and ordinary command contexts.
Feature-detect it when supporting hosts that predate this addition.

Provider callbacks use invocation-owned process and file APIs. A ready local
workspace remains the default process directory. Preparation and cleanup can run
before target readiness, using the project's default local folder as the process
directory, or the owned managed directory when no local project folder exists.
An explicit `cwd` can select either source or destination. Ordinary commands
retain their ready-local-target checks. Await every process and file operation:
the host stops running child processes when a provider callback ends, is
cancelled, or exceeds its existing 30-second operation limit. Retained directory
handles reject operations after the callback ends. Explicit `spawnDetached`
continues to mean an independently running process.

## Migrating from older API versions

Before `0.1.0`, the extension API used `1.0.0-alpha.N` versions. An extension written for an older alpha needs these changes. See [API versioning](0014-api-versioning.md) for the current scheme.

### Changes in 1.0.0-alpha.12

Native-history harnesses must implement `recoverMessages(ctx, { knownMessages, nativeMessages, cwd, workspace })`. Return `{ kind: "recovered", messages }`. Returning `{ kind: "conflict", category }` makes the host continue from the saved conversation, so prefer the saved side inside a harness instead of returning a conflict. A failed native read must throw; returning `[]` declares a successful empty history. Use the SDK's pure ordered-history helpers and keep provider-specific comparisons in the harness.

Every harness event sink now provides `getMessages()`. Full-snapshot providers must read it after asynchronous polling and compose any harness-generated metadata before synchronously publishing the replacement. Root replacements remain authoritative. When a snapshot cannot be composed safely, a provider must leave the readable messages unchanged.

### Bounded tool results on main

The host limits each tool result to 256 KiB of serialized UTF-8, including output,
error details, returned metadata, and shortening metadata. Inputs, ordinary text,
and reasoning are unchanged. Oversized results retain their start and end with an
omitted-byte note. Structured results become text summaries. Saved and synced
conversations retain this bounded view; the host does not archive the discarded middle.

Use `normalizeToolResult` or `normalizeMessageResults` before retaining native
results in a harness. `createToolOutputBuffer()` keeps bounded streaming text;
call `append(delta)` and read `result()` for the current `output` and optional
`resultSummary`. `appendJson(value)` retains the serialized view without allocating
a complete second JSON string. Small values keep their original type when normalized.

`ToolResultSummary` is versioned and carries original byte counts and fingerprints.
Keep it with the result. Never infer shortening from the visible omission text.
`toolOutputFingerprint(part)` compares the original output even after shortening;
for results with `returnDisplay`, it compares that display view. The host applies
`projectToolResultRecovery` to checkpoints and native history before calling recovery,
preserving saved summaries across allowance changes and recovering native-only tails.

`publishConversationChanges(sink, messages)` publishes indexed additions,
replacements, and deletions from an authoritative normalized snapshot. Compose
host metadata first and then call it synchronously. Unchanged messages are not
republished. It does not remove a provider's full-history polling or normalization cost.

These additive helpers and metadata share the planned extension API 0.3.1 release.
Publish the SDK and matching host before extensions adopt them.

Renderer read callbacks receive an AbortSignal. Forward it through command execution and all child I/O, and do not resolve a load before its children settle. Native renderers declare their refresh dependencies explicitly with extension events and the public `viewDataEvents` references. The host no longer reloads every extension view on unrelated sync changes.

### Changes in 1.0.0-alpha.14

Navigation and resource removal use explicit context APIs. The host no longer interprets a command's returned value as a navigation target or a deletion report. Return ordinary data to the caller.

- Call `ctx.navigation.open(target)` from commands and interaction callbacks. Table and kanban row activation callbacks return void. Navigation still uses the existing target types and dispatcher, applies only after successful UI execution, and does not affect dashboards during headless execution.
- After deleting data, call `await ctx.resources.removed(resource)`. This reports the committed removal to every connected client, independently of command success. Keep missing-resource handling and update-only writes so a stale save cannot recreate deleted data.
- Remove imports of the workbench's `toWorkbenchNavigationTargetResult` and `isExtensionNavigationTarget` aliases. Use the SDK's `isNavigationTarget` for explicit target validation and `toWorkbenchNavigationTarget` when adapting a target to the workbench.

## Stream command output

Declare a JSON chunk type with `streamOf` and await each write:

```ts
import { defineCommand, streamOf } from "@pstdio/sdk/extensions";

export const progress = defineCommand({
  id: "progress",
  title: "Progress",
  cli: true,
  stream: streamOf<{ done: number; total: number }>(),
  async run(ctx) {
    for (let done = 1; done <= 3; done++) {
      ctx.signal?.throwIfAborted();
      await ctx.stream.write({ done, total: 3 });
    }
    return { total: 3 };
  },
});
```

`ctx.stream.write` waits for the reader. A chunk over 64 KiB of serialized JSON rejects with `command_stream_chunk_too_large`; later writes still work. The runner limits queued socket writes to 256 chunks or 1 MiB. Once the reader stops, writes reject with `command_stream_closed` and `ctx.signal` is aborted. Pass that signal to other long-running work.

Ordinary command execution, hooks, schedules, automation, and nested `ctx.commands.execute` calls discard chunks and keep their normal final outcome. Streaming a command without a declaration fails with `command_not_streamable`.

HTTP SDK callers use `client.extensions.stream(commandId, { projectId, ...body }, { signal })`. Its async iterable yields `{ type: "data", data }` and a final `{ type: "end", response }` containing the full command response. Break the loop or abort the signal to release the subscription.

See [streamed webview commands](0005-webview-and-storage-api.md#streamed-commands) and [the transport decision](../../adrs/0065-stream-command-results-over-the-shared-client-stream.md).

## Resource mutation previews

A command can declare `resourceMutation` for a dashboard resource rename or removal. It names the resource type and the parameter containing its ID. A rename also names the parameter containing the new label.

```ts
resourceMutation: { kind: "rename", resourceType: "note", idParam: "noteId", labelParam: "title" }
// Removal uses: { kind: "remove", resourceType: "note", idParam: "noteId" }
```

The dashboard previews the change in navigation, tabs, and breadcrumbs while the command saves. Removal asks for confirmation first. Failure restores the affected resource. Writes for the same resource are ordered, and a failed earlier action cannot undo a newer preview. The preview stays until the mounted resource views refresh. The command still owns validation, persistence, and refresh events. API and CLI calls run the command directly, without a UI preview or confirmation. Commands without this declaration keep their existing behavior.

## Sessions

`ctx.sessions` exposes the host's session operations inside the current project. The capabilities below are available on `main` in extension API 0.2.2 and ship after 0.45.0. `ctx.sessions.get(sessionId)` and conversation reads also include `projectId`, `agentSessionId`, `sessionFileId`, and saved harness `params`. Mutations reject missing or foreign sessions. Reading a synced personal conversation does not start execution on this device; continue it on its owning device.

| Method | Behavior |
| --- | --- |
| `ctx.sessions.getConversation(sessionId)` | Returns `{ session, messages }`, including pending queued messages. |
| `ctx.sessions.getConversationSources(sessionId)` | Reads checkpoint and native history separately, with source errors. |
| `ctx.sessions.getQueuedMessages(sessionId)` | Reads the pending messages and queue without loading conversation history. |
| `ctx.sessions.stream(sessionId, onEvent, { signal }?)` | Awaits snapshot and live events: `ready`, `patch`, `approval_request`, `queued_messages`, and `end`. The callback receives a typed `{ event, data }` value and may return a promise for backpressure. |
| `ctx.sessions.retainResources(sessionId)` | Returns `{ close() }` to keep idle harness resources while needed. |
| `ctx.sessions.approve(sessionId, { id, decision })` | Resolves a tool approval request with `approve` or `deny`. |
| `ctx.sessions.rename(sessionId, title)` | Renames the session; trims and rejects an empty title. |
| `ctx.sessions.archive(sessionId)` | Archives the session and records its activity. |
| `ctx.sessions.delete(sessionId)` | Deletes an inactive session. Active or queued work must be stopped first. Workspace files and native history are kept. |
| `ctx.sessions.updateStatus(sessionId, status)` | Uses the host's status transition service. Use `stop` to cancel execution. |
| `ctx.sessions.listActivity(sessionId, input?)` | Returns `{ items, nextCursor }`; accepts `eventType`, `from`, `to`, `cursor`, and `limit`. |
| `ctx.sessions.removeQueuedFollowUp(sessionId, queuePosition, expectedRevision?)` | Removes a pending request; rejects a stale revision or a request being consumed. |
| `ctx.sessions.moveQueuedFollowUp(sessionId, queuePosition, input)` | Moves a request `up` or `down`, optionally by `steps`, with `expectedRevision` and `expectedOrder` guards. Returns its new `queuePosition`. |
| `ctx.sessions.getDraftHarnessCommands({ harness, workspaceId? })` | Discovers native commands before creating a session. `harness` uses `{ harnessId, model?, params? }`. |
| `ctx.sessions.getHarnessCommands(sessionId)` | Reads native commands and modes for an existing session. |
| `ctx.sessions.invokeHarnessOperation(sessionId, operation, expectedHarnessId?)` | Runs a native command or control through the host's execution and cancellation rules. |
| `ctx.sessions.resolveSessionId({ harnessId, agentSessionId, cwd? })` | Resolves a native identity within this project; rejects ambiguous matches. |
| `ctx.sessions.uploadAttachment({ name, data, mimeType? })` | Uploads supported attachment bytes. Returns the canonical attachment fields, including `fileId`. The same type and size limits apply as in the app. |
| `ctx.sessions.readAttachment(fileId)` | Reads attachment bytes from this project. |
| `ctx.sessions.deleteAttachment(fileId)` | Deletes an unsubmitted attachment; submitted or in-flight files are kept. |

Conversation patches may replace all `/messages` or update an individual `/messages/<index>`. While a stream callback is busy, pending conversation changes are coalesced into a current `/messages` snapshot. Apply each patch to the conversation instead of waiting for a particular indexed patch.

Streams and resource retention are released when the invoking command ends or is cancelled. Closing a stream or retention handle does not stop the agent session. A webview can forward stream events through a command declared with `streamOf`, using `await ctx.stream.write(event)` in the callback. See [command streams](#stream-command-output).

`ctx.sessions.create` also accepts `operation` to start with a native command instead of a prompt, and returns its optional `operationResult`. `ctx.sessions.followup` accepts `harness` to select the next harness, model, or parameters, `questionResponse: { callId?, answers }` to answer a structured question, and `summaryFromSessionId`, `summaryFormat`, and `summaryRole` to include another project session's summary. Attachments remain references of the form `{ file_id }`. An answer to a question cannot include attachments. Existing `expectedRun` guards still reject continuation after execution changes.

Use `await ctx.sessions.stop(sessionId)` to cancel a session in the current project and its queued follow-ups. This is available on `main` in extension API 0.2.2 and ships after 0.45.0. It supports queued, running, and awaiting-input sessions. The host waits for the harness's stop acknowledgement when the harness supports it. Harness failures and a change of execution owner reject the call; a caller must not report a successful stop in that case. Read the session again before deciding what to do next. Missing sessions and sessions from another project are rejected. Calling stop on a terminal session also records explicit stop intent and cancels its queued follow-ups. An uncertain live-input delivery remains recorded for host recovery.

Use `ctx.sessions.query(input?)` to read sessions in the current project. It returns `{ items, nextCursor }`. Each item includes `agent` (harness ID), `last_selected_model`, `workspace_id`, status, archive state, anchors, creation and update times, latest-run start and end times, and `usage`.

Filters can be combined:

- `status`: an array of statuses; an empty array matches no sessions.
- `agent`: a harness ID.
- `workspaceId`: a workspace ID or shorthand in this project. A missing or foreign workspace rejects with `Workspace not found`.
- `anchor`: `{ type, id }` for an attached resource.
- `createdFrom`, `createdTo`, `updatedFrom`: inclusive ISO timestamp bounds.
- `includeArchived`: defaults to false.

Pages are ordered by `created_at` descending, then `id` descending. `limit` defaults to 50 and is clamped to 1 through 200. Pass the opaque `nextCursor` to read the next page. Invalid cursors and cursors from another project restart at the first page. New sessions added before the cursor do not shift later pages.

```ts
import type { ExtensionSessionSummary } from "@pstdio/sdk/extensions";

const sessions: ExtensionSessionSummary[] = [];
const createdFrom = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
let cursor: string | undefined;
do {
  const page = await ctx.sessions.query({
    createdFrom,
    limit: 200,
    cursor,
  });
  sessions.push(...page.items);
  cursor = page.nextCursor ?? undefined;
} while (cursor);

const counts: Record<string, number> = {};
for (const session of sessions) {
  const harness = session.agent ?? "unknown";
  counts[harness] = (counts[harness] ?? 0) + 1;
}
```

`last_request_started` and `last_request_ended` describe the latest run only. `usage` sums the saved conversation's input, output, cache read and cache write tokens. It is null for sessions with no recorded usage, including old sessions until their next save. Show the number of sessions with unknown usage alongside any total. See [session token totals](../../adrs/0119-session-token-totals.md).

Without a workspace filter, `workspace_id` is the earliest linked workspace, with link ID breaking timestamp ties. With a workspace filter it is the selected workspace. Multiple links do not duplicate session items.

`get()` and `create()` also expose the typed harness ID as `agent`. Use `query()` or `query({ workspaceId })` to list sessions. Read every `nextCursor` page when a command needs the full history. Results are newest first and exclude archived sessions unless `includeArchived: true` is set.

Views can refresh on `viewDataEvents.sessionsChanged` (`view.sessions.changed`). Query with `updatedFrom` and merge by session ID. Webviews read sessions through an extension command using `commands.execute`.

### Workspace presentation and device capacity

`ctx.workspaces.getCapacity()` reads this device's live count and limit. Pass `{ deviceId }` to read another online account device through the existing authenticated project-device channel. Offline or unavailable devices reject the read; do not present their last synced history as a live count. `updateCapacity({ limit })` always updates the current device only.

Native file views can declare `saveMode: "manual"` to retain drafts until an explicit save. Declare `document: { metadataKey: "path" }` when a resource contains several documents; this keeps editor identity stable when unrelated metadata changes. Match the page's document declaration. Workspace text sources accept `{ kind: "workspace", workspaceId, path }` for a selected local workspace; omitting `workspaceId` keeps the default project-folder behavior. Source validation enforces the current project, local execution, readiness and file capabilities. Resolve and project such a source through `ctx.workspaces.readFile(workspaceId, path)` and `writeFile(workspaceId, path, { content })`; these APIs observe the source bytes and reject stale writes. `ctx.workspaceFiles` continues to address the invocation workspace.

Native tree nodes support `rowVariant: "file"`, a `fileName` icon hint and `showContextMenuTrigger`. An action with a single text input can declare `inputPresentation: { kind: "inline", field: "name", placement: "child" }` to create under the row, or `placement: "replace"` to rename it. The host owns pending input, Escape, validation errors and command submission. `copyText` copies a declared string during the user gesture.

Use `workbenchCommands.openWorkspaceTerminal` with a workspace resource to open the persistent platform terminal. `workbenchCommands.revealWorkspaceEntry` takes `{ path }`, relative to that resource's authorized local workspace, and appears only when desktop reveal is available. Extensions must not call desktop globals. Resource-list enum options can declare `noteAction` to open details from a group note independently of expanding the group or Add.

## Project extension management (API 0.3.1 on main)

`ctx.extensions.list()` returns the invoking project's installed instances, including disabled ones, and the configured catalog with resolved icons.

`ctx.extensions.install(installNames)` accepts catalog extensions for the invoking project and returns once the selection is saved, without waiting for installation. It rejects the whole call if any name is not in the catalog. The host installs each source once, reuses an installed source, enables it only in this project, and provisions the project's workspaces when the extension needs it. Other projects keep their own choices.

Installation continues in the background and survives a runtime restart. Selecting an extension again while it is pending has no effect. Selecting it again after it finished re-enables it in this project; after it failed, it runs again. Restarting the runtime does not replay finished work or retry failures on its own. Use `ctx.extensions.list()` to see which extensions the project has enabled.

The call takes no project argument. Older hosts omit `ctx.extensions`; extensions that need it declare API `^0.3.1`.

*Updated at: 2026-11-25*
