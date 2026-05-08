# Prompt Studio SDK Extension API

This proposal describes the SDK-facing extension API after the latest design discussion.

The model is intentionally small:

```txt
commands      executable operations
middlewares   command interceptors that may modify or reject an invocation
hooks         event subscribers
events        emitted signals/facts, including automatic command lifecycle events
```

The runtime keeps one clear rule:

```txt
middleware can affect a command
hook can only react to an event
```

There are no command before/after hook fields and no event declarations inside `defineExtension()`. Command interception is handled by `middlewares`; event subscription is handled by `hooks`.

---

## 1. Core Principles

### Commands do work

A command is the only executable primitive. Commands are used by the CLI, dashboard menus, command panel, schedules, automations, and other commands.

Examples:

```txt
planner.tickets.create
planner.tickets.pull
workspace.openInVSCode
harness.claudeCode.detect
```

A command returns a transport-safe outcome:

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

### Middlewares intercept commands

A middleware attaches to a command. It runs during command execution before the command handler.

A middleware may:

```txt
continue
patch params
replace params / invocation
reject the command
```

A middleware is where validation, normalization, policy checks, repo resolution, defaulting, and enrichment belong.

Middleware order is **not guaranteed** in this version. Authors must not rely on ordering between middlewares. The runtime may use a deterministic internal order for repeatability, but that order is not part of the public contract. Ordering, dependency constraints, and conflict handling can be expanded later.

### Events are observable signals

An event is emitted by the runtime, kernel, or an extension. Events are not declared in `defineExtension()`. Extensions may emit any event id, and type-safe event refs should be exported from the package that owns the domain contract.

Examples:

```ts
// pstdio-ext-planner/contract
export const plannerEvents = {
  ticketCreated: eventRef<{ ticketId: string; title: string }>(
    "planner.ticket.created",
  ),
  ticketSynced: eventRef<{ ticketId: string; direction: "pull" | "push" }>(
    "planner.ticket.synced",
  ),
};
```

### Hooks subscribe to events

A hook observes an event. It cannot mutate or veto the command that emitted that event.

Hooks are used for activity records, notifications, follow-up commands, artifact sync, analytics, and custom side effects.

### The SDK stays workflow-agnostic

`@pstdio/sdk` exports generic platform primitives only:

```ts
import {
  defineExtension,
  defineSlot,
  commandRef,
  commandEvent,
  eventRef,
  packageAsset,
  params,
  projectSlots,
  sessionSlots,
} from "@pstdio/sdk/extensions";
```

Workflow-specific contracts come from the owning extension package:

```ts
import {
  plannerCommands,
  plannerEvents,
  plannerSlots,
} from "pstdio-ext-planner/contract";
import { workspaceSlots } from "pstdio-ext-workspace-shell/contract";
```

The core SDK must not export planner, ticket, workspace-shell, template-viewer, skill-viewer, or harness-provider contracts.

---

## 2. Extension Source and Management

### Source lives at the Prompt Studio root

For now, extension source lives under the Prompt Studio root:

```txt
~/.pstdio/extensions/<extension-name>/
  extension.ts
  package.json
  README.md
  templates/
  skills/
  webviews/
```

`PSTDIO_HOME` may override `~/.pstdio`.

Extensions are toggled on or off per project. The source is shared. If project A needs a different version of an extension than project B, copy the extension folder, change the extension `id`/`namespace`, modify it, and enable that copy for project A.

```txt
~/.pstdio/extensions/planner/
~/.pstdio/extensions/planner-acme/
```

### Live reload

The extension runtime watches `~/.pstdio/extensions/**`.

When source changes:

```txt
1. invalidate the extension runtime cache
2. reload extension metadata
3. re-run diagnostics
4. refresh command, middleware, hook, slot, view, template, skill, and artifact metadata
5. notify connected dashboard/CLI clients when supported
```

Running command invocations are not interrupted. The next metadata request or command execution uses the reloaded runtime.

This is the reason `pstdio extensions add` pulls source instead of only installing opaque packages: coding agents and users can inspect, edit, and extend extension source locally.

### `pstdio extensions add`

`pstdio extensions add` installs extension source into the Prompt Studio root. When run inside a project, it also auto-enables the installed extension for that project.

```bash
pstdio extensions add planner
pstdio extensions add ./local-extension
```

Supported flags:

| Flag                    | Effect                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `--name <install-name>` | Override the install folder name.                                       |
| `--force`               | Replace an existing install at the target path.                         |
| `--skip-install`        | Skip the dependency-install step inside the installed extension folder. |

Short names resolve from the Prompt Studio repo (`https://github.com/pufflyai/prompt-studio` at `extensions/<name>`). Local paths are copied as-is.

Expected flow:

```txt
pstdio extensions add planner
  -> resolve source from default repo or explicit path
  -> copy source to ~/.pstdio/extensions/planner
  -> install deps with a package manager (preferred from extension; fallback to whichever of bun/yarn/npm is on PATH) unless --skip-install or no package.json
  -> load extension manifest
  -> register or update the local source record
  -> if inside a project: enable for that project via the API
  -> run diagnostics
  -> show installed metadata + project enablement state
```

Example output:

```txt
Installed extension

Name:       Planner
ID:         pstdio.planner
Namespace:  planner
Version:    0.1.0
Source:     ~/.pstdio/extensions/planner

Enabled for project:
  prompt-studio

Diagnostics:
  Errors:   0
  Warnings: 0
```

The API auto-installs a configured list of default extensions on first project create using the same install primitive. Each entry is either a named extension (resolved from the Prompt Studio repo) or a local folder path — the latter is useful for dev environments. Default list: `pstdio-core-skills`, `pstdio-core-templates`.

### Project toggles

The project stores enablement/configuration through project-scoped extension instances for root-installed extensions. Source is not copied into the project by default.

```bash
pstdio extensions add planner
pstdio extensions list
pstdio extensions enable planner
pstdio extensions disable planner
pstdio extensions remove planner
pstdio extensions check
```

Semantics:

```txt
enable    load this extension for the current project
disable   stop loading it for the current project; keep source and data
remove    unregister it from the current project; keep source by default
check     validate enabled extension source and contributions
```

Deleting the source folder is a separate operation and should be explicit, because multiple projects may use the same source.

### Tracking installed and enabled extensions

The local machine tracks source records:

```ts
type LocalExtensionSource = {
  name: string;
  path: string;
  origin?: string;
  installedAt: string;
  updatedAt: string;
};
```

The API tracks enabled extension instances at a generic scope. Project enablement is represented as `scopeType: "project"`.

```ts
type ExtensionInstance = {
  id: string;
  scopeType: "user" | "project" | string;
  scopeId: string;
  extensionId: string;
  namespace: string;
  sourceName: string;
  enabled: boolean;
  config: Record<string, unknown>;
};
```

Instance state is API-owned. The CLI and dashboard read/write it through the API.

---

## 3. Top-Level Extension Shape

```ts
import { defineExtension, packageAsset, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "pstdio.planner",
  namespace: "planner",
  name: "Planner",
  version: "0.1.0",
  description: "Planner workflow extension.",

  settings: {
    defaultStatus: params.text({ label: "Default status", defaultValue: "backlog" }),
  },

  slots: {},

  commands: {},
  middlewares: {},
  hooks: {},
  schedules: {},

  navigation: {},
  views: {},
  routes: {},
  settingsPanels: {},
  activityRenderers: {},
  sessionAnchorRenderers: {},

  artifactMounts: {},
  templateTypes: {},
  templates: {},
  skills: {},
  themes: {},
  fileIconThemes: {},

  workspaceTypes: {},
  harnesses: {},

  initialSetup: async (ctx) => {},
  migrate: async (ctx, fromVersion) => {},
});
```

Notable omissions:

```txt
no events field       event refs live in contract modules; emission is not restricted
no before/after fields command interception is middleware
event subscribers     are declared under hooks
```

---

## 4. Namespaces and IDs

Every extension has:

```ts
id: "pstdio.planner";
namespace: "planner";
```

The `id` is the globally descriptive identity. The `namespace` is the project-facing API name and must be unique among enabled extensions in a project.

The namespace scopes:

```txt
commands        planner.tickets.create
CLI             pstdio planner tickets create
artifacts       .pstdio/planner/...
storage         project + extension id/namespace
owned events    planner.ticket.created
owned slots     planner.ticket.header.overflow
```

A local command id is scoped into a full command id:

```ts
commands: {
  "tickets.create": { /* ... */ },
}
```

becomes:

```txt
planner.tickets.create
```

---

## 5. Commands

### Basic command

```ts
export default defineExtension({
  id: "pstdio.planner",
  namespace: "planner",
  name: "Planner",

  commands: {
    "tickets.create": {
      title: "Create ticket",
      description: "Create a planner ticket.",

      params: {
        title: params.text({ label: "Title", required: true }),
        body: params.longText({ label: "Body" }),
      },

      cli: true,

      async run(ctx) {
        const ticket = await ctx.storage.collection("tickets").create({
          title: ctx.params.title,
          body: ctx.params.body,
        });

        await ctx.events.emit("planner.ticket.created", {
          ticketId: ticket.id,
          title: ticket.title,
        });

        return ticket;
      },
    },
  },
});
```

The command does not declare a `target` field. Resource context comes from invocation.

A command may be invoked from:

```txt
CLI
command panel
menu slot
schedule
automation
another command
```

Invocation context can include:

```ts
type CommandInvocation<TParams> = {
  params: TParams;
  resource?: ResourceRef;
  repoId?: string;
  repoPath?: string;
  slot?: SlotInvocationContext;
};
```

For example, a ticket page menu item provides a ticket resource. A workspace header item provides a workspace resource. A CLI invocation may provide no resource unless the user passes one.

### Command panel

All commands are available in the command panel by default.

```ts
commands: {
  "tickets.create": {
    title: "Create ticket",
    async run(ctx) {},
  },
}
```

To hide a command from the command panel:

```ts
commands: {
  "internal.reindex": {
    title: "Reindex planner storage",
    commandPanel: false,
    async run(ctx) {},
  },
}
```

To customize command-panel presentation:

```ts
commands: {
  "tickets.create": {
    title: "Create ticket",
    commandPanel: {
      group: "Planner",
      keywords: ["ticket", "issue", "task"],
    },
    async run(ctx) {},
  },
}
```

### CLI exposure

Commands are not automatically exposed through the CLI. A command opts into CLI exposure with `cli`.

```ts
commands: {
  "tickets.create": {
    title: "Create ticket",
    cli: true,
    async run(ctx) {},
  },
}
```

For namespace `planner`, the default scoped path is:

```bash
pstdio planner tickets create
```

A command can customize the scoped path:

```ts
cli: {
  path: ["tickets", "new"],
  description: "Create a planner ticket",
  examples: ["pstdio planner tickets new --title 'Fix login bug'"],
}
```

which produces:

```bash
pstdio planner tickets new
```

Global aliases are optional and must be validated for collisions:

```ts
cli: {
  path: ["tickets", "new"],
  globalAliases: [["tickets", "create"]],
}
```

which additionally exposes:

```bash
pstdio tickets create
```

The CLI router should refuse ambiguous command paths and show provider diagnostics rather than picking silently.

---

## 6. Command Execution Lifecycle

When a command is executed:

```txt
ctx.commands.execute(command)
  -> emit command.requested
  -> run middlewares
  -> if rejected: emit command.rejected, return rejected outcome
  -> emit command.started
  -> run command handler
  -> if success: emit command.completed, return success outcome
  -> if error: emit command.failed, return error outcome
```

Command lifecycle events are generated by the runtime and can be referenced with `commandEvent()`:

```ts
commandEvent(plannerCommands.tickets.create, "requested");
commandEvent(plannerCommands.tickets.create, "started");
commandEvent(plannerCommands.tickets.create, "completed");
commandEvent(plannerCommands.tickets.create, "rejected");
commandEvent(plannerCommands.tickets.create, "failed");
```

Lifecycle event ids follow the canonical wire format:

```txt
command.<phase>:<commandId>
```

For example, `command.completed:planner.tickets.create`. Hooks subscribed by raw string id must use this format; `commandEvent()` is the recommended way to construct it.

Meanings:

```txt
requested   execute() was called
started     middleware passed and the command handler is about to run
completed   command handler returned successfully
rejected    middleware rejected the invocation
failed      command handler threw or returned an error outcome
```

Hooks on these events cannot affect the command. Only middleware can affect command execution.

---

## 7. Middlewares

Middlewares attach to commands.

```ts
import { plannerCommands } from "pstdio-ext-planner/contract";

export default defineExtension({
  id: "project.ticket-policy",
  namespace: "ticketPolicy",
  name: "Ticket Policy",

  middlewares: {
    rejectDoomTickets: {
      command: plannerCommands.tickets.create,

      async handler(ctx) {
        const title = String(ctx.params.title ?? "");

        if (title.toUpperCase().includes("DOOM")) {
          return ctx.commands.reject({
            code: "doom_rejected",
            reason: `Ticket title "${title}" contains DOOM — refusing.`,
          });
        }
      },
    },
  },
});
```

### Normalize params

```ts
middlewares: {
  normalizeTicketTitle: {
    command: plannerCommands.tickets.create,

    async handler(ctx) {
      return ctx.commands.replaceParams({
        ...ctx.params,
        title: String(ctx.params.title ?? "").trim(),
      });
    },
  },
}
```

### Patch params

```ts
middlewares: {
  defaultTicketStatus: {
    command: plannerCommands.tickets.create,

    async handler(ctx) {
      if (ctx.params.statusId) return;

      return ctx.commands.patchParams({
        statusId: "backlog",
      });
    },
  },
}
```

### Replace invocation

Use replacement when a middleware needs to change more than params, such as the resource or repo context.

```ts
middlewares: {
  resolveTicketShorthand: {
    command: plannerCommands.tickets.update,

    async handler(ctx) {
      if (!ctx.params.shorthand) return;

      const ticket = await ctx.storage.collection("tickets").get(ctx.params.shorthand);
      if (!ticket) {
        return ctx.commands.reject({
          code: "ticket_not_found",
          reason: `Ticket ${ctx.params.shorthand} was not found.`,
        });
      }

      return ctx.commands.replaceInvocation({
        ...ctx.invocation,
        resource: {
          type: "ticket",
          id: ticket.id,
          label: ticket.title,
          extensionId: "pstdio.planner",
        },
        params: {
          ...ctx.params,
          ticketId: ticket.id,
        },
      });
    },
  },
}
```

### Middleware ordering

Ordering is not guaranteed in this version.

Guidance:

```txt
write middlewares to be independent where possible
avoid depending on another middleware having already run
avoid durable side effects in middleware
emit domain events from commands, not middleware
use diagnostics if two middlewares produce incompatible changes
```

Ordering and dependency constraints can be added later without changing the core concepts.

---

## 8. Events and Hooks

### Custom event emission

```ts
await ctx.events.emit("planner.ticket.synced", {
  ticketId,
  direction: "pull",
});
```

For type safety, domain packages export event refs:

```ts
export const plannerEvents = {
  ticketSynced: eventRef<{ ticketId: string; direction: "pull" | "push" }>(
    "planner.ticket.synced",
  ),
};
```

Then:

```ts
await ctx.events.emit(plannerEvents.ticketSynced, {
  ticketId,
  direction: "pull",
});
```

### Hook on a custom event

```ts
hooks: {
  recordTicketSynced: {
    event: plannerEvents.ticketSynced,

    async handler(ctx, event) {
      await ctx.activity.record({
        message: `Synced ticket ${event.ticketId}`,
        target: { type: "ticket", id: event.ticketId, extensionId: "pstdio.planner" },
        metadata: { direction: event.direction },
      });
    },
  },
}
```

### Hook on a command lifecycle event

```ts
hooks: {
  notifyTicketCreateRejected: {
    event: commandEvent(plannerCommands.tickets.create, "rejected"),

    async handler(ctx, event) {
      await ctx.notify.toast({
        type: "warning",
        title: "Ticket not created",
        message: event.reason,
      });
    },
  },
}
```

### Hook failures

A hook failure does not change the command outcome that caused the event. The runtime records hook failures as diagnostics/activity. Critical work that must be part of a command should run inside the command handler, not in an event hook.

---

## 9. Slots, Menus, Views, and Context

A slot is a host-defined mount point. It is not synonymous with an iframe.

The host shell provides different mount points:

```txt
menus
navigation
sidebars
side panels
tabs
settings panels
activity renderers
session anchor renderers
```

The owner of a surface owns the slots and their context contract.

```ts
// pstdio-ext-planner/contract
export type TicketSlotContext = {
  projectId: string;
  resource: ResourceRef & { type: "ticket" };
  ticket: {
    id: string;
    title: string;
    statusId?: string;
  };
};

export const plannerSlots = {
  ticketHeaderOverflow: defineSlot<TicketSlotContext, "menu">(
    "planner.ticket.header.overflow",
    { kind: "menu", label: "Ticket overflow actions" },
  ),

  ticketSidePanel: defineSlot<TicketSlotContext, "view">(
    "planner.ticket.sidePanel",
    { kind: "view", label: "Ticket side panel" },
  ),
};
```

When a command is launched from a slot, the invocation receives slot context:

```ts
async run(ctx) {
  ctx.resource;      // usually the primary resource from the slot
  ctx.slot?.id;      // planner.ticket.header.overflow
  ctx.slot?.context; // typed by the slot owner in authoring code
}
```

### Menu contribution

Menus are host-rendered command contributions.

```ts
commands: {
  "tickets.archive": {
    title: "Archive ticket",

    menus: [
      {
        slot: plannerSlots.ticketHeaderOverflow,
        label: "Archive ticket",
      },
    ],

    async run(ctx) {
      const ticketId = ctx.resource?.id;
      // ...
    },
  },
}
```

### View contribution

Views, side panels, tabs, settings panels, activity renderers, and session anchor renderers are serializable webview descriptors when they need custom UI.

```ts
views: {
  ticketInspector: {
    title: "Inspector",
    slot: plannerSlots.ticketSidePanel,
    webview: {
      entry: packageAsset("./webviews/ticket-inspector/index.html", import.meta.url),
    },
  },
}
```

Extension definitions must not pass dashboard React components or in-process dashboard component references.

### Settings panels

Settings panels attach to settings slots.

```ts
settingsPanels: {
  plannerSettings: {
    title: "Planner",
    slot: projectSlots.settingsPanels,
    webview: {
      entry: packageAsset("./webviews/settings/index.html", import.meta.url),
    },
  },
}
```

### Sidebar slots

Sidebar contributions can be navigation items or webview-backed panels depending on the slot kind.

```ts
navigation: {
  plannerNav: {
    slot: projectSlots.sidebarNav,
    label: "Planner",
    command: plannerCommands.tickets.list,
  },
}
```

---

## 10. Repo Context and Artifact Mounts

Artifacts are repo-context files that coding agents should be able to read or edit.

Artifact mounts always resolve under:

```txt
<repo>/.pstdio/<extension.namespace>/
```

Example:

```ts
export default defineExtension({
  id: "pstdio.planner",
  namespace: "planner",
  name: "Planner",

  artifactMounts: {
    tickets: {
      path: "tickets",
      label: "Tickets",
    },
  },
});
```

The `tickets` mount resolves to:

```txt
.pstdio/planner/tickets
```

Usage:

```ts
const tickets = ctx.artifacts.mount("tickets");

await tickets.writeText("PS-123/ticket.md", markdown);
```

Physical path:

```txt
<repo>/.pstdio/planner/tickets/PS-123/ticket.md
```

Invalid mount paths:

```ts
artifactMounts: {
  absolute: { path: "/tmp/things", label: "No" },
  escape: { path: "../tickets", label: "No" },
  rawPstdio: { path: ".pstdio/tickets", label: "No" },
}
```

The kernel normalizes paths and prevents escaping the extension namespace root.

Repo context is required anywhere local files or execution paths are involved. CLI command execution should pass the current repo path or repo id to the API, and the API resolves the selected repo before constructing `ctx.artifacts`.

---

## 11. Extension Storage and Files

Extension storage is API-owned and namespaced by extension instance. Project-owned storage also carries the project id.

```ts
await ctx.storage.set("lastSyncAt", new Date().toISOString());

const statuses = ctx.storage.collection("statuses");
await statuses.put("backlog", {
  id: "backlog",
  label: "Backlog",
});
```

Storage scopes:

```ts
ctx.storage.scope({ type: "project" });
ctx.storage.scope({ type: "repo", repoId: ctx.repo?.repoId });
ctx.storage.scope({ type: "resource", resource: ctx.resource });
```

Use `ctx.files` for project-owned editable files that do not need to live in repo context. Extension template and skill content should be edited in the installed extension source folder, not through `ctx.files`. Those file changes refresh enabled projects the same way extension source edits do.

Use `ctx.artifacts` for repo-context files that should be visible to coding agents.

Settings declared in `defineExtension({ settings })` are read and written through `ctx.settings`. Values are scoped by project and extension.

```ts
const defaultStatus = await ctx.settings.get("defaultStatus");
await ctx.settings.set("defaultStatus", "backlog");

const all = await ctx.settings.all();
```

`ctx.settings.get` returns `undefined` when no value has been written and the descriptor has no `defaultValue`. Settings UIs should populate values through the standard settings panel; `ctx.settings.set` exists for migrations and command-driven preference flows.

---

## 12. Templates and Skills

Extensions can contribute default templates and skills as source assets. The contribution examples below are the contract source: template and skill catalog items resolve extension assets by extension instance plus contribution key. They do not create project `files`, `templates`, or `skills` rows for extension-owned assets. Extension template edits through the dashboard/API write back to the installed extension source file. Extension skill edits happen in the installed extension source folder, and project setup installs extension skills into enabled agent directories.

```ts
export default defineExtension({
  id: "pstdio.planner",
  namespace: "planner",
  name: "Planner",

  templateTypes: {
    ticket: {
      label: "Ticket",
      description: "Templates used for planner tickets.",
    },
  },

  templates: {
    defaultTicket: {
      title: "Default Ticket",
      type: "ticket",
      source: packageAsset("./templates/default-ticket.md", import.meta.url),
    },
  },

  skills: {
    triage: {
      title: "Ticket Triage",
      source: packageAsset("./skills/triage.md", import.meta.url),
    },
  },
});
```

Runtime behavior:

```txt
extension template   source asset, editable through installed source or dashboard/API
extension skill      source asset, edited in installed source and installed to enabled agents
project disablement  stored as project preference
catalog source       source_kind is "extension"; project rows use source_kind "project"
copy/customize       creates project-owned preference state or a separate copied extension source
project variation    edit files in the installed extension folder
```

Project-specific variations use a copied extension source with a different extension `id` and `namespace`; edit template and skill files in that copied extension folder.

---

## 12.1 Appearance Contributions

Extensions can contribute native Prompt Studio appearance assets. These are package assets, not VS Code extension manifests. Compatibility adapters should map external manifests into this native surface.

```ts
export default defineExtension({
  id: "pstdio.appearance",
  namespace: "appearance",
  name: "Appearance",

  themes: {
    monokai: {
      title: "Monokai",
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/monokai.json", import.meta.url),
    },
  },

  fileIconThemes: {
    seti: {
      title: "Seti",
      format: "vscode-file-icon-theme",
      source: packageAsset("./icons/seti.json", import.meta.url),
    },
  },
});
```

Runtime behavior:

```txt
themes           vscode-color-theme JSON/JSONC package assets
fileIconThemes   vscode-file-icon-theme JSON/JSONC package assets
diagnostics      invalid package assets, missing files, malformed JSONC, and missing icon font assets
Chakra           editor/shell colors map to semantic token overrides for the active theme preference
Monaco           editor themes derive from the selected extension theme
```

Theme ids are namespace-scoped, for example `appearance.monokai`. File icon theme records expose icon definitions plus file extension/name resolver maps so file-list UI can consume them incrementally.

---

## 13. Schedules

Schedules execute commands. They do not define a separate handler system.

```ts
schedules: {
  heartbeat: {
    title: "Planner heartbeat",
    cron: "*/15 * * * *",
    command: plannerCommands.heartbeat,
    params: {},
  },
}
```

Repo-scoped scheduled commands must declare or resolve a repo context. A schedule may pin its target via `repoId` (preferred for stable identity) or `repoPath` (for absolute path-driven setups); if both are provided, `repoId` wins. If neither is set and the project has multiple repos, the runtime should report an ambiguity diagnostic.

---

## 14. Harnesses and Workspace Types

Harness providers are executable integrations. The kernel owns the harness registry and selection flow. Extensions own provider-specific implementation.

```ts
harnesses: {
  claudeCode: {
    id: "claude-code",
    label: "Claude Code",

    async detect(ctx) {
      // check executable availability
    },

    async start(ctx, input) {
      // start provider executable
    },
  },
}
```

Workspace lifecycle remains kernel-owned, but extensions can provide workspace types and workspace UI slots.

```ts
workspaceTypes: {
  worktree: {
    id: "worktree",
    label: "Git worktree",
    async create(ctx, input) {},
    async resolve(ctx, workspace) {},
  },
}
```

---

## 15. Activity and Diagnostics

Activity remains kernel-owned. Extensions can record activity with generic resource refs:

```ts
await ctx.activity.record({
  message: "Created ticket PS-123",
  target: {
    type: "ticket",
    id: "PS-123",
    extensionId: "pstdio.planner",
  },
  metadata: {
    sourceExtension: ctx.extensionId,
  },
});
```

`pstdio extensions check` should validate:

```txt
source exists
extension default export is valid
extension id and namespace are unique in the project
source folder name and extension metadata are understandable
command ids are valid
CLI scoped paths and global aliases do not collide
middlewares reference existing commands
hooks reference valid event refs or event ids
slot contributions resolve and match slot kind
webview/package assets exist
artifact paths stay inside .pstdio/<namespace>
template and skill assets exist
harness detection results are reported
storage migrations succeeded
```

Diagnostics should include extension id, namespace, source path, project id, and repo context where applicable.

---

## 16. Runtime and API Boundary

The API owns DB-backed state and stateful command execution.

CLI and dashboard flow:

```txt
CLI/dashboard
  -> ask API for enabled extension metadata
  -> render commands/slots/views/settings/help
  -> execute command through API
  -> API resolves project + repo context
  -> API loads extension runtime
  -> API emits lifecycle events, runs middleware, runs command, emits outcome events
  -> API persists storage/activity/sync changes
```

Clients must not open the DB or construct DB services.

Repo-context artifact file IO is still mediated by safe artifact mount APIs. Any project metadata changes caused by artifact IO go through API services.

---

## 17. Cookbook

### 17.1 Create a command

```ts
commands: {
  "tickets.create": {
    title: "Create ticket",
    params: {
      title: params.text({ required: true }),
    },
    cli: true,

    async run(ctx) {
      const ticket = await ctx.storage.collection("tickets").create({
        title: ctx.params.title,
      });

      await ctx.events.emit("planner.ticket.created", {
        ticketId: ticket.id,
        title: ticket.title,
      });

      return ticket;
    },
  },
}
```

Available by default in the command panel, and via CLI because `cli: true`:

```bash
pstdio planner tickets create --title "Fix login"
```

### 17.2 Add middleware that blocks a command

```ts
middlewares: {
  rejectDoomTicket: {
    command: plannerCommands.tickets.create,

    async handler(ctx) {
      const title = String(ctx.params.title ?? "");

      if (title.toUpperCase().includes("DOOM")) {
        return ctx.commands.reject({
          code: "doom_rejected",
          reason: "Ticket titles cannot contain DOOM.",
        });
      }
    },
  },
}
```

### 17.3 Add middleware that modifies params

```ts
middlewares: {
  trimTicketTitle: {
    command: plannerCommands.tickets.create,

    async handler(ctx) {
      return ctx.commands.replaceParams({
        ...ctx.params,
        title: String(ctx.params.title ?? "").trim(),
      });
    },
  },
}
```

### 17.4 Hook on command rejection

```ts
hooks: {
  warnWhenTicketCreateRejected: {
    event: commandEvent(plannerCommands.tickets.create, "rejected"),

    async handler(ctx, event) {
      await ctx.notify.toast({
        type: "warning",
        title: "Ticket not created",
        message: event.reason,
      });
    },
  },
}
```

### 17.5 Hook on custom event

```ts
hooks: {
  recordTicketCreated: {
    event: plannerEvents.ticketCreated,

    async handler(ctx, event) {
      await ctx.activity.record({
        message: `Created ticket ${event.ticketId}`,
        target: { type: "ticket", id: event.ticketId, extensionId: "pstdio.planner" },
      });
    },
  },
}
```

### 17.6 Add a ticket page menu item

```ts
commands: {
  "tickets.archive": {
    title: "Archive ticket",

    menus: [
      {
        slot: plannerSlots.ticketHeaderOverflow,
        label: "Archive",
      },
    ],

    async run(ctx) {
      const ticketId = ctx.resource?.id;
      if (!ticketId) {
        return ctx.commands.reject({
          code: "missing_ticket",
          reason: "A ticket resource is required.",
        });
      }

      // archive ticket
    },
  },
}
```

### 17.7 Add a side panel

```ts
views: {
  ticketInspector: {
    title: "Inspector",
    slot: plannerSlots.ticketSidePanel,
    webview: {
      entry: packageAsset("./webviews/inspector/index.html", import.meta.url),
    },
  },
}
```

### 17.8 Add a settings page

```ts
settingsPanels: {
  plannerSettings: {
    title: "Planner",
    slot: projectSlots.settingsPanels,
    webview: {
      entry: packageAsset("./webviews/settings/index.html", import.meta.url),
    },
  },
}
```

### 17.9 Add an artifact mount

```ts
artifactMounts: {
  tickets: {
    path: "tickets",
    label: "Tickets",
  },
}
```

Writes to:

```txt
.pstdio/planner/tickets/...
```

### 17.10 Add templates and skills

```ts
templateTypes: {
  ticket: { label: "Ticket" },
},

templates: {
  defaultTicket: {
    title: "Default Ticket",
    type: "ticket",
    source: packageAsset("./templates/default-ticket.md", import.meta.url),
  },
},

skills: {
  triage: {
    title: "Triage",
    source: packageAsset("./skills/triage.md", import.meta.url),
  },
}
```

### 17.11 Install and edit an extension

```bash
pstdio extensions add planner
code ~/.pstdio/extensions/planner
pstdio extensions check
```

Changes under `~/.pstdio/extensions/planner` live-reload for every project that has `planner` enabled.

For a project-specific variant:

```bash
cp -R ~/.pstdio/extensions/planner ~/.pstdio/extensions/planner-acme
code ~/.pstdio/extensions/planner-acme/extension.ts
pstdio extensions enable planner-acme
pstdio extensions disable planner
```

The copy must declare a distinct `id` and `namespace`.

---

## 18. Known Gaps and Future Expansion

The current design intentionally leaves room for these follow-ups:

```txt
middleware ordering and dependency constraints
middleware conflict detection for competing param mutations
extension dependency declarations
capability declarations and future trust boundaries
contract versioning for slots, events, and command refs
source update/diff semantics for modified root extensions
durable event delivery / retry policies
cloud-hosted extension execution
project-specific extension forks without manual copying
```

The current simple rule remains:

```txt
commands execute
middlewares intercept commands
hooks observe events
source lives at ~/.pstdio/extensions and live-reloads
pstdio extensions add installs source and auto-enables for the current project
projects enable or disable shared source copies
```
