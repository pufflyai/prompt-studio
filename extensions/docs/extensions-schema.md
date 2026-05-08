# Prompt Studio v2 Extension Platform

These schema notes define the durable data model and runtime registry shapes for the Prompt Studio v2 extension platform.

The final extension model separates **installed extension source** from **scope-aware extension instances**:

```txt
Installed extension source
  Editable source under ~/.pstdio/extensions/<install-name>

Extension instance
  An enabled/disabled/configured reference to installed source at a generic scope
```

Extensions are source-installed so users and coding agents can inspect, modify, and extend them locally. Projects commonly toggle installed extensions on or off through project-scoped instances, while harnesses or future capabilities can use another scope. If two projects need different behavior, the user copies the extension source, modifies the copy, and enables the desired variant per project.

All schema-backed reads and writes are API-owned. `pstdio-api` opens the database, constructs DB services, enforces domain rules, emits activity/sync events, executes extension commands, and exposes HTTP/SDK operations to the CLI, dashboard, future TUI, SDK consumers, and extension adapters.

Clients must not import `pstdio-db`, construct DB services, or open the DB directly.

---

## Core Decisions

- Extensions are installed as editable source under `~/.pstdio/extensions/<install-name>`.
- `pstdio extensions add <extension>` installs extension source into the Prompt Studio user root.
- Extension instances enable, disable, remove, and configure installed extensions at the scope selected by services/runtime policy.
- Extension source is live-reloaded on change.
- The runtime has commands, middleware, hooks, custom events, schedules, slots, views, routes, navigation, templates, skills, themes, file icon themes, and harness providers.
- Commands are the only executable primitive.
- Middleware intercepts command execution and can modify params or reject execution.
- Hooks subscribe to events and cannot block or mutate the producing operation.
- Events are not declared in `defineExtension`; they are emitted by commands/kernel/services or represented by typed contract refs.
- All commands are visible in the command panel by default unless `commandPanel: false`.
- Commands do not have a static `target`; resource context comes from invocation context.
- Artifact mounts resolve under `.pstdio/<extension.namespace>/...`.
- Canonical CLI paths are scoped by extension namespace: `pstdio <namespace> ...`.

---

## Existing Tables to Preserve During Migration

| Table                                                         | Current Purpose                                      | Target Owner                                                |
| ------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `projects`                                                    | Project identity and metadata                        | Kernel                                                      |
| `repos`, `project_repos`                                      | Repo records and project links                       | Kernel                                                      |
| `sessions`                                                    | AI interaction records                               | Kernel                                                      |
| `workspaces`, `ticket_workspaces`, `workspace_sessions`       | Workspace lifecycle and current ticket/session links | Kernel lifecycle, extension anchors                         |
| `files`                                                       | Stored file metadata                                 | Kernel file storage                                         |
| `tickets`                                                     | Ticket records                                       | `pstdio.planner` extension storage / planner-owned services |
| `ticket_statuses`                                             | Project ticket columns/statuses                      | `pstdio.planner` extension storage / planner-owned services |
| `ticket_tags`, `ticket_tag_options`, `ticket_tag_assignments` | Project ticket labels/tags                           | `pstdio.planner` extension storage / planner-owned services |
| `templates`                                                   | Project templates backed by files                    | Template registry                                           |
| `skills`                                                      | Project skills backed by files                       | Skill registry with project variations                      |
| `agent_configs`                                               | Current agent setup                                  | Harness registry migration                                  |
| `activity_events`                                             | Audit/activity records                               | Kernel, broadened to generic resource refs                  |

During migration, existing ticket/status/tag tables may continue to physically back planner-owned services. The ownership boundary should move behind the planner extension contract before physical schema changes are made.

---

# Durable Entities

## Installed Extension Source

- **Location:** API-owned user extension catalog, backed by `pstdio-db` or an equivalent user-root catalog service.
- **Purpose:** track editable extension source installed under the Prompt Studio user root.
- **Default source root:** `~/.pstdio/extensions/<install-name>`.

This is user-level source, not project-specific enablement.

| Field             |    Type | Nullable | Notes                                                           |
| ----------------- | ------: | -------: | --------------------------------------------------------------- |
| `id`              |  `text` |       no | Primary key                                                     |
| `install_name`    |  `text` |       no | User-facing installed name, e.g. `planner`, `extension-lab`     |
| `extension_id`    |  `text` |       no | Stable id from `defineExtension`, e.g. `pstdio.planner`         |
| `namespace`       |  `text` |       no | CLI/artifact namespace, e.g. `planner`                          |
| `display_name`    |  `text` |       no | Human-readable name                                             |
| `version`         |  `text` |      yes | Version declared by extension source                            |
| `source_path`     |  `text` |       no | Absolute local source path under `~/.pstdio/extensions/...`     |
| `source_kind`     |  `text` |       no | `catalog`, `github`, `local-copy`, `local-link`, or `manual`    |
| `source_ref`      |  `text` |      yes | Catalog id, GitHub URL/ref, artifact id, or original local path |
| `manifest_json`   | `jsonb` |       no | Cached manifest metadata from the last successful load          |
| `last_loaded_at`  |  `text` |      yes | Last successful runtime load                                    |
| `last_error_json` | `jsonb` |      yes | Last load error or diagnostics snapshot                         |
| `created_at`      |  `text` |       no | Timestamp                                                       |
| `updated_at`      |  `text` |       no | Timestamp                                                       |

Recommended unique constraints:

```txt
unique(source_path)
unique(install_name)
```

Recommended diagnostic constraint:

```txt
extension_id and namespace should be stable for a given installed source unless the user explicitly accepts the change.
```

Notes:

- `pstdio extensions add <source>` creates or updates an installed extension source.
- Installed source is shared across projects.
- Extension source is live-reloaded on file changes.
- A project-specific variant should be created by copying the source to a new install name.
- Extension source changes must not delete project extension storage or preferences.

Example source roots:

```txt
~/.pstdio/extensions/planner
~/.pstdio/extensions/planner-custom
~/.pstdio/extensions/extension-lab
```

---

## Extension Instance

- **Location:** new DB table/service in `packages/pstdio-db`, constructed by `pstdio-api`.
- **Purpose:** scope-aware enablement, config, and diagnostics for an installed extension.

This is the durable toggle/config layer. Project-level enablement is the common case, but scope is data rather than a table split.

| Field                    |      Type | Nullable | Notes                                                        |
| ------------------------ | --------: | -------: | ------------------------------------------------------------ |
| `id`                     |    `text` |       no | Primary key                                                  |
| `installed_extension_id` |    `text` |       no | References installed extension source                        |
| `extension_id`           |    `text` |       no | Stable extension id from source                              |
| `scope_type`             |    `text` |       no | Generic scope, such as `user` or `project`                   |
| `scope_id`               |    `text` |       no | Scope identifier                                             |
| `namespace`              |    `text` |       no | Namespace used for CLI, artifacts, and canonical command ids |
| `display_name`           |    `text` |       no | Cached display name                                          |
| `enabled`                | `boolean` |       no | Disabled keeps config and storage                            |
| `config_json`            |   `jsonb` |       no | Project-owned extension config                               |
| `diagnostics_json`       |   `jsonb` |      yes | Last project-level diagnostics                               |
| `created_at`             |    `text` |       no | Timestamp                                                    |
| `updated_at`             |    `text` |       no | Timestamp                                                    |

Recommended unique constraints:

```txt
unique(scope_type, scope_id, extension_id)
unique(scope_type, scope_id, namespace)
```

Notes:

- A project can enable or disable installed extensions.
- Disabling an extension does not delete storage, artifacts, preferences, or project config.
- Removing an extension instance should not delete installed source.
- Purging extension data must be explicit.

Canonical management commands:

```bash
pstdio extensions add planner
pstdio extensions list
pstdio extensions enable pstdio.planner
pstdio extensions disable pstdio.planner
pstdio extensions remove pstdio.planner
pstdio extensions check
```

---

## Extension KV

- **Location:** new table in `packages/pstdio-db`, accessed through API-owned extension storage services.
- **Purpose:** namespaced structured extension state without arbitrary SQL schemas.

| Field          |    Type | Nullable | Notes                                                                     |
| -------------- | ------: | -------: | ------------------------------------------------------------------------- |
| `project_id`   |  `text` |      yes | References `projects.id` when state is project-owned                      |
| `extension_instance_id` |  `text` |       no | References `extension_instances.id`                              |
| `scope_type`   |  `text` |       no | `project`, `repo`, `ticket`, `workspace`, `session`, or extension-defined |
| `scope_id`     |  `text` |       no | Empty string for project scope                                            |
| `key`          |  `text` |       no | KV key                                                                    |
| `value_json`   | `jsonb` |       no | Stored value                                                              |
| `created_at`   |  `text` |       no | Timestamp                                                                 |
| `updated_at`   |  `text` |       no | Timestamp                                                                 |

Primary key:

```txt
(extension_instance_id, scope_type, scope_id, key)
```

Recommended indexes:

```txt
(extension_instance_id)
(extension_instance_id, scope_type, scope_id)
```

Notes:

- Extension storage is keyed by extension instance. Project-owned rows also carry `project_id`.
- Repo-scoped storage uses `scope_type = "repo"` and `scope_id = repoId`.
- Extension source reloads, updates, disablement, and removal from a project must not implicitly delete stored values.

---

## Extension Collection Item

- **Location:** new table in `packages/pstdio-db`, accessed through API-owned extension storage services.
- **Purpose:** collection storage for extension-owned records such as ticket indexes, custom catalogs, sync state, or domain records.

| Field          |    Type | Nullable | Notes                          |
| -------------- | ------: | -------: | ------------------------------ |
| `project_id`   |  `text` |      yes | References `projects.id` when state is project-owned |
| `extension_instance_id` |  `text` |       no | References `extension_instances.id`        |
| `scope_type`   |  `text` |       no | Scope type                     |
| `scope_id`     |  `text` |       no | Empty string for project scope |
| `collection`   |  `text` |       no | Collection name                |
| `item_id`      |  `text` |       no | Item id inside collection      |
| `value_json`   | `jsonb` |       no | Stored item                    |
| `created_at`   |  `text` |       no | Timestamp                      |
| `updated_at`   |  `text` |       no | Timestamp                      |

Primary key:

```txt
(extension_instance_id, scope_type, scope_id, collection, item_id)
```

Recommended indexes:

```txt
(extension_instance_id, collection)
(extension_instance_id, scope_type, scope_id, collection)
```

---

## Extension Template Preference

- **Location:** new table in `packages/pstdio-db`, accessed through API-owned template registry services.
- **Purpose:** per-project enablement for extension default templates.

| Field          |      Type | Nullable | Notes                           |
| -------------- | --------: | -------: | ------------------------------- |
| `project_id`   |    `text` |       no | References `projects.id`        |
| `extension_instance_id` |    `text` |       no | Provider extension instance |
| `template_key` |    `text` |       no | Key inside extension definition |
| `enabled`      | `boolean` |       no | Defaults to true                |
| `updated_at`   |    `text` |       no | Timestamp                       |

Primary key:

```txt
(project_id, extension_instance_id, template_key)
```

---

## Extension Skill Preference

- **Location:** new table in `packages/pstdio-db`, accessed through API-owned skill registry services.
- **Purpose:** per-project enablement for extension default skills.

| Field          |      Type | Nullable | Notes                           |
| -------------- | --------: | -------: | ------------------------------- |
| `project_id`   |    `text` |       no | References `projects.id`        |
| `extension_instance_id` |    `text` |       no | Provider extension instance |
| `skill_key`    |    `text` |       no | Key inside extension definition |
| `enabled`      | `boolean` |       no | Defaults to true                |
| `updated_at`   |    `text` |       no | Timestamp                       |

Primary key:

```txt
(project_id, extension_instance_id, skill_key)
```

---

## Extension Schedule State

- **Location:** new table only if schedules need project-level override, enablement, or execution bookkeeping.
- **Purpose:** store per-project schedule settings and last-run state. Schedule definitions themselves come from extension source.

| Field               |      Type | Nullable | Notes                                                     |
| ------------------- | --------: | -------: | --------------------------------------------------------- |
| `project_id`        |    `text` |       no | References `projects.id`                                  |
| `extension_instance_id` |    `text` |       no | Provider extension instance                         |
| `schedule_key`      |    `text` |       no | Key inside extension definition                           |
| `enabled`           | `boolean` |       no | Defaults to true unless extension declares otherwise      |
| `params_json`       |   `jsonb` |      yes | Project override/default params for the scheduled command |
| `resource_json`     |   `jsonb` |      yes | Optional scheduled resource context                       |
| `repo_id`           |    `text` |      yes | Required for repo-scoped scheduled commands               |
| `last_started_at`   |    `text` |      yes | Last scheduled execution start                            |
| `last_completed_at` |    `text` |      yes | Last successful completion                                |
| `last_error_json`   |   `jsonb` |      yes | Last failure details                                      |
| `updated_at`        |    `text` |       no | Timestamp                                                 |

Primary key:

```txt
(project_id, extension_instance_id, schedule_key)
```

Notes:

- Schedules invoke commands; they do not have their own business handler.
- Scheduled commands run through normal command middleware and command lifecycle events.
- Project-scoped schedules can run without repo context.
- Repo-scoped schedules must declare or resolve a repo.

---

# Runtime Registry Records

The following records are normalized from extension source and generally live in memory, with optional diagnostics snapshots. They are not durable tables by default.

## Command Record

- **Location:** in-memory command registry, with optional diagnostics snapshot.
- **Purpose:** normalized executable primitive for CLI, UI, command panel, schedules, middleware, and command events.

| Field          |                         Type | Nullable | Notes                                                   |
| -------------- | ---------------------------: | -------: | ------------------------------------------------------- |
| `id`           |                     `string` |       no | Fully qualified id: `${namespace}.${commandKey}`        |
| `extensionId`  |                     `string` |       no | Provider extension id                                   |
| `namespace`    |                     `string` |       no | Provider namespace                                      |
| `key`          |                     `string` |       no | Local command key inside extension                      |
| `title`        |                     `string` |       no | Display name                                            |
| `description`  |                     `string` |      yes | Help text                                               |
| `params`       |                `ParamSchema` |      yes | Drives CLI/UI inputs                                    |
| `menus`        |         `MenuContribution[]` |      yes | Host-shell menu placements                              |
| `cli`          | `boolean \| CliContribution` |      yes | CLI exposure; canonical path is namespace + command key |
| `commandPanel` |                    `boolean` |      yes | Defaults to true                                        |
| `source`       |    `ExtensionSourceLocation` |       no | Source file/extension for diagnostics                   |

Important rules:

- Commands do **not** have a fixed `target` field.
- Resource context comes from invocation context: CLI, menu slot, route, workspace, session, schedule, or explicit `ctx.commands.execute(...)` input.
- All commands appear in the command panel by default unless `commandPanel: false`.
- Canonical command ids use the extension namespace, not the extension id.

Canonical CLI path:

```txt
pstdio <namespace> <command key split on dots>
```

Example extension command:

```ts
commands: {
  "tickets.create": {
    title: "Create ticket",
    cli: true,
  },
}
```

Canonical CLI:

```bash
pstdio planner tickets create
```

Optional CLI aliases may provide shorter paths, but collisions must be diagnosed and refused.

---

## Appearance Records

- **Location:** in-memory appearance registry, exposed through API/check responses.
- **Purpose:** native Prompt Studio theme and file icon theme contributions from extension package assets.

Theme records:

| Field         |          Type | Nullable | Notes                                           |
| ------------- | ------------: | -------: | ----------------------------------------------- |
| `id`          |      `string` |       no | Fully qualified id: `${namespace}.${themeKey}`  |
| `extensionId` |      `string` |       no | Provider extension id                           |
| `format`      |      `string` |       no | `vscode-color-theme`                            |
| `mode`        | `light\|dark` |       no | Explicit contribution mode or inferred fallback |
| `source`      |  package asset |       no | JSON/JSONC color theme asset                    |
| `tokens`      |      `object` |       no | Chakra semantic token overrides                 |
| `monacoTheme` |      `object` |       no | Monaco theme data derived from the asset        |

File icon theme records:

| Field            |         Type | Nullable | Notes                                              |
| ---------------- | -----------: | -------: | -------------------------------------------------- |
| `id`             |     `string` |       no | Fully qualified id: `${namespace}.${themeKey}`     |
| `extensionId`    |     `string` |       no | Provider extension id                              |
| `format`         |     `string` |       no | `vscode-file-icon-theme`                           |
| `source`         | package asset |       no | JSON/JSONC icon theme asset                        |
| `definitions`    |     `object` |       no | Icon definitions from the asset                    |
| `fileExtensions` |     `object` |       no | Extension-to-icon map for file list consumers      |
| `fileNames`      |     `object` |       no | File-name-to-icon map for file list consumers      |

Diagnostics must report invalid package asset descriptors, missing assets, malformed JSONC, and missing file icon font assets without crashing extension loading.

---

## Middleware Record

- **Location:** in-memory registry, with optional diagnostics snapshot.
- **Purpose:** intercept command execution before command `run`.

Middleware can:

```txt
continue
replace params
reject execution
```

Middleware cannot observe arbitrary custom events; that is handled by hooks.

| Field         |                      Type | Nullable | Notes                                 |
| ------------- | ------------------------: | -------: | ------------------------------------- |
| `id`          |                  `string` |       no | Fully qualified id                    |
| `extensionId` |                  `string` |       no | Provider extension                    |
| `commandId`   |                  `string` |       no | Command being intercepted             |
| `handler`     |                `function` |       no | API-executed middleware handler       |
| `source`      | `ExtensionSourceLocation` |       no | Source file/extension for diagnostics |

Middleware ordering:

```txt
No ordering guarantee in v1.
```

If multiple middlewares apply to the same command, the runtime may use a deterministic internal order, but extension authors must not rely on it. Ordering and dependencies can be added later.

Command lifecycle:

```txt
ctx.commands.execute(command)
  -> emit command.requested
  -> run middlewares
  -> if rejected: emit command.rejected and return
  -> emit command.started
  -> run command
  -> emit command.completed or command.failed
```

---

## Hook Record

- **Location:** in-memory registry, with optional diagnostics snapshot.
- **Purpose:** subscribe to events.

Hooks observe events. They cannot block or modify the command/event that produced them.

| Field         |                      Type | Nullable | Notes                                  |
| ------------- | ------------------------: | -------: | -------------------------------------- |
| `id`          |                  `string` |       no | Fully qualified hook id                |
| `extensionId` |                  `string` |       no | Provider extension                     |
| `eventId`     |                  `string` |       no | Event id or command lifecycle event id |
| `handler`     |                `function` |       no | API-executed event handler             |
| `source`      | `ExtensionSourceLocation` |       no | Source file/extension for diagnostics  |

Events may be:

```txt
custom emitted events
automatic command lifecycle events
kernel/domain events
```

Custom event example:

```ts
await ctx.events.emit("planner.ticket.created", {
  ticketId,
});
```

Hook example:

```ts
hooks: {
  observeCreate: {
    event: "planner.ticket.created",
    async handler(ctx, event) {},
  },
}
```

Command lifecycle event example:

```ts
hooks: {
  observeRejectedDelete: {
    event: commandEvent(plannerCommands.tickets.delete, "rejected"),
    async handler(ctx, event) {},
  },
}
```

---

## Schedule Record

- **Location:** extension definition plus scheduler registry; durable state belongs in `extension_schedule_state` only when needed.
- **Purpose:** invoke commands on a schedule.

Schedules do not have their own business handler. They invoke commands.

| Field         |                      Type | Nullable | Notes                                       |
| ------------- | ------------------------: | -------: | ------------------------------------------- |
| `id`          |                  `string` |       no | Fully qualified schedule id                 |
| `extensionId` |                  `string` |       no | Provider extension                          |
| `title`       |                  `string` |       no | Display name                                |
| `cron`        |                  `string` |       no | Cron expression                             |
| `commandId`   |                  `string` |       no | Command to execute                          |
| `params`      | `Record<string, unknown>` |      yes | Default scheduled params                    |
| `resource`    |             `ResourceRef` |      yes | Optional scheduled resource context         |
| `repoId`      |                  `string` |      yes | Required for repo-scoped scheduled commands |
| `source`      | `ExtensionSourceLocation` |       no | Source file/extension for diagnostics       |

---

## Artifact Mount Record

- **Location:** extension definition plus kernel registry; persisted only if diagnostics/cache need it.
- **Purpose:** safe repo-context file access under `.pstdio/<namespace>`.

Artifact mounts always resolve under the extension namespace:

```txt
<repo>/.pstdio/<extension.namespace>/<mount.path>
```

Example definition:

```ts
defineExtension({
  id: "pstdio.planner",
  namespace: "planner",

  artifactMounts: {
    tickets: {
      path: "tickets",
      label: "Tickets",
    },
  },
});
```

Resolved path:

```txt
.pstdio/planner/tickets
```

| Field           |   Type | Nullable | Notes                                                                     |
| --------------- | -----: | -------: | ------------------------------------------------------------------------- |
| `extension_id`  | `text` |       no | Owning extension                                                          |
| `namespace`     | `text` |       no | Extension namespace                                                       |
| `mount_key`     | `text` |       no | Key used by `ctx.artifacts.mount(...)`                                    |
| `path`          | `text` |       no | Relative path under `.pstdio/<namespace>`                                 |
| `resolved_root` | `text` |       no | Derived runtime path, not author-provided                                 |
| `label`         | `text` |       no | Display label                                                             |
| `repo_scope`    | `text` |      yes | `selected`, `default`, or `workspace`; default is selected execution repo |

Invariant:

```txt
An extension may only mount paths under .pstdio/<namespace>/.
```

Invalid author-provided paths:

```txt
/tmp/things
../tickets
.pstdio/tickets
.pstdio/other-extension/tickets
```

Compatibility note:

- Existing `.pstdio/tickets/<shorthand>/ticket.md` can be supported by a planner migration/import command.
- The v2 canonical path is `.pstdio/planner/tickets/...`.

---

## Slot Context Contract

- **Location:** SDK type contracts plus owning extension contract packages.
- **Purpose:** describe resource/context provided by host-shell mount points.

The surface owner owns the slot and the slot context.

Examples:

```txt
projectSlots.sidebarNav          owned by kernel/project shell
workspaceSlots.header.primary    owned by workspace shell extension
ticketSlots.header.overflow      owned by planner extension
```

A slot contribution receives context from the slot owner.

Example ticket slot context:

```ts
type TicketSlotContext = {
  resource: ResourceRef & {
    type: "ticket";
  };
  ticket: {
    id: string;
    title: string;
    statusId?: string;
  };
  projectId: string;
  repoId?: string;
};
```

Schema impact:

- Slot definitions are registry metadata, not durable schema by default.
- Diagnostics should track unresolved slots, invalid slot kinds, and incompatible contributions.
- Slot context is a contract/API concern rather than a DB table.

---

## View, Route, Navigation, and Settings Records

- **Location:** extension definition plus UI registry; persisted only in diagnostics/cache if needed.
- **Purpose:** transport-safe UI contributions to host-owned slots and routes.

Rules:

- Extension UI contributions are serializable descriptors.
- Extension definitions must not pass React components or dashboard component references.
- Menus, navigation, sidebar items, settings panels, routes, and views attach to host-owned slots/mount points.
- Custom UI surfaces use webview descriptors.
- Navigation should reference route keys/refs rather than hard-coded route paths where possible.

Common contribution kinds:

| Contribution             | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `menus`                  | Host-rendered command placements                           |
| `views`                  | Webview-backed tabs, sidebars, panels, or other view slots |
| `routes`                 | Extension routes rendered by the host shell                |
| `navigation`             | Host-rendered nav/sidebar entries                          |
| `settings`               | Settings panels inside host-owned settings shells          |
| `activityRenderers`      | Webview-backed renderers for activity/resource records     |
| `sessionAnchorRenderers` | Webview-backed renderers for session anchors               |

---

## Harness Provider Record

- **Location:** extension definition and in-memory harness registry.
- **Purpose:** executable integration boundary for Claude Code, OpenCode, and future harnesses.

| Field    |       Type | Nullable | Notes                             |
| -------- | ---------: | -------: | --------------------------------- |
| `id`     |   `string` |       no | Provider id                       |
| `label`  |   `string` |       no | Display label                     |
| `detect` | `function` |      yes | Executable/environment detection  |
| `start`  | `function` |       no | Starts executable process/session |
| `send`   | `function` |      yes | Follow-up input                   |
| `stop`   | `function` |      yes | Stop run                          |

Notes:

- Harness provider metadata is registry data, not necessarily durable schema.
- Project/user harness configuration may continue to use migrated `agent_configs` backing storage initially.

---

# Shared Contracts

## Resource Ref

- **Location:** SDK and API contracts.
- **Purpose:** replace fixed activity/workspace/session resource assumptions.

| Field         |                      Type | Nullable | Notes                                                  |
| ------------- | ------------------------: | -------: | ------------------------------------------------------ |
| `type`        |                  `string` |       no | `ticket`, `workspace`, `session`, or extension-defined |
| `id`          |                  `string` |       no | Resource id                                            |
| `projectId`   |                  `string` |      yes | Owning project                                         |
| `label`       |                  `string` |      yes | Display label                                          |
| `extensionId` |                  `string` |      yes | Provider extension for extension-owned resources       |
| `metadata`    | `Record<string, unknown>` |      yes | Non-indexed details                                    |

Migration note:

```txt
activity_events.resource_type is currently fixed to known resources.
v2 needs a string-based resource contract or a new activity target shape.
```

---

## Template Record

- **Location:** current `templates`/`files` tables plus extension template preference table, exposed through API services.
- **Purpose:** active template catalog from source-backed extension defaults and project preferences.

| Field                   |                         Type | Nullable | Notes                                             |
| ----------------------- | ---------------------------: | -------: | ------------------------------------------------- |
| `id`                    |                       `text` |       no | Catalog id                                        |
| `project_id`            |                       `text` |      yes | Owning project for project rows/preferences       |
| `template_type`         |                       `text` |       no | Extension-owned or kernel-owned template type     |
| `name`                  |                       `text` |       no | Project template name or extension contribution key |
| `title`                 |                       `text` |       no | Extension contribution title or project name      |
| `file_id`               |                       `text` |      yes | Required only when `source_kind = "project"`      |
| `is_default`            |                    `boolean` |       no | Project default flag                              |
| `source_kind`           | `"project" \| "extension"` |       no | Logical source                                    |
| `extension_instance_id` |                       `text` |      yes | Required only when `source_kind = "extension"`    |
| `template_key`          |                       `text` |      yes | Extension contribution key                        |
| `source`                |     `PackageAssetDescriptor` |      yes | Extension `packageAsset` descriptor               |

Notes:

- Extension default templates are package/source assets, not editable API `files`; catalog items must not fabricate `file_id`.
- Template content changes are made by editing the installed extension source file directly or through the dashboard/API source writer.
- Project-specific template variations use a copied extension source with a different extension `id` and `namespace`.
- Extension-owned template types should come from the owning extension contract where possible.

---

## Skill Record

- **Location:** current `skills`/`files` tables plus extension skill preference table.
- **Purpose:** active skill catalog from source-backed extension defaults and project preferences.

Extension skills may be file or directory package assets.

| Field                   |                         Type | Nullable | Notes                                            |
| ----------------------- | ---------------------------: | -------: | ------------------------------------------------ |
| `id`                    |                       `text` |       no | Catalog id                                       |
| `project_id`            |                       `text` |      yes | Owning project for project rows/preferences      |
| `name`                  |                       `text` |       no | Project skill name or extension contribution key |
| `title`                 |                       `text` |       no | Extension contribution title or project name     |
| `files`                 |                `SkillFile[]` |      yes | Present only when `source_kind = "project"`      |
| `source_kind`           | `"project" \| "extension"` |       no | Logical source                                   |
| `extension_instance_id` |                       `text` |      yes | Required only when `source_kind = "extension"`   |
| `skill_key`             |                       `text` |      yes | Extension contribution key                       |
| `source`                |     `PackageAssetDescriptor` |      yes | Extension `packageAsset` descriptor              |

Notes:

- Extension skills may be file or directory package assets under the installed extension source.
- Skill content changes are made by editing the installed extension source file or folder.
- Extension setup installs skill files into all configured agents enabled for the project.
- Project-specific skill variations use a copied extension source with a different extension `id` and `namespace`.

---

## Workspace Record Extension

- **Location:** current `workspaces` table plus migration columns or derived contract.
- **Purpose:** keep workspace lifecycle kernel-owned while allowing workspace types and anchors.

| Field          |    Type | Nullable | Notes                                                         |
| -------------- | ------: | -------: | ------------------------------------------------------------- |
| `type`         |  `text` |       no | `root`, `worktree`, or extension-defined workspace type       |
| `repo_id`      |  `text` |      yes | Source repo for lifecycle, diff, merge, cleanup, and sessions |
| `anchors_json` | `jsonb` |       no | `ResourceRef[]`, replacing ticket-only relationship over time |

Provider-specific state for extension-defined workspace types is deferred until a real consumer needs it. Add a `state_json` column when an extension declares a non-kernel workspace type.

Migration note:

```txt
Keep ticket_workspaces during extraction.
Project ticket/workspace relationships into anchors over time.
```

---

## Session Record Extension

- **Location:** current `sessions` table plus migration column.
- **Purpose:** allow sessions to anchor to non-workspace resources (e.g. tickets, extension-owned resources) while keeping `workspace_sessions` as the kernel-level workspace↔session link.

| Field          |    Type | Nullable | Notes                                       |
| -------------- | ------: | -------: | ------------------------------------------- |
| `anchors_json` | `jsonb` |       no | `ResourceRef[]` for non-workspace relations |

Notes:

- `workspace_sessions` continues to own the kernel workspace↔session relationship.
- `anchors_json` is additive: a session can be anchored to a ticket or any extension-defined resource without coupling kernel sessions to extension tables.

---

## Planner Local Ticket Workflow

- **Location:** `pstdio.planner` extension source, planner contract, planner SDK helpers, and API-executed planner services.
- **Purpose:** keep local ticket artifact pull/push behavior behind the planner extension.

Canonical v2 artifact mount:

```txt
.pstdio/planner/tickets/<shorthand>/ticket.md
```

Compatibility import path:

```txt
.pstdio/tickets/<shorthand>/ticket.md
```

| Field          |     Type | Nullable | Notes                                       |
| -------------- | -------: | -------: | ------------------------------------------- |
| `extension_id` | `string` |       no | `pstdio.planner`                            |
| `namespace`    | `string` |       no | `planner`                                   |
| `workflow`     | `string` |       no | Built-in local ticket workflow              |
| `mount_key`    | `string` |       no | `tickets`                                   |
| `mount_path`   | `string` |       no | `tickets`, resolved under `.pstdio/planner` |
| `config_json`  |  `jsonb` |      yes | Project-owned planner configuration         |

Notes:

- The planner extension owns ticket resources, statuses, labels, slots, templates, and local artifact workflow.
- Current `.pstdio/tickets` files should be preserved by a migration/import flow, not by weakening the generic mount invariant.

---

# Extension Management

## `pstdio extensions add`

`pstdio extensions add <source>` installs extension source into the Prompt Studio user root. When run inside a project, it also auto-enables the installed extension for that project through the project-enablement API.

Default install location:

```txt
~/.pstdio/extensions/<install-name>
```

Supported flags:

| Flag                    | Effect                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `--name <install-name>` | Override the install folder name.                                       |
| `--force`               | Replace an existing install at the target path.                         |
| `--skip-install`        | Skip the dependency-install step inside the installed extension folder. |

Examples:

```bash
pstdio extensions add planner
pstdio extensions add extension-lab
pstdio extensions add ./my-extension
```

Recommended behavior:

1. Resolve the extension source from a named extension (default repo `https://github.com/pufflyai/prompt-studio` at `extensions/<name>`) or a local folder path.
2. Copy source into `~/.pstdio/extensions/<install-name>`.
3. Run a package manager (`bun`, `yarn`, or `npm`) inside the installed folder when a `package.json` is present (skip with `--skip-install`). Selection: prefer the PM the extension declares (`packageManager` field, then lockfile: `bun.lock`/`bun.lockb` → bun, `yarn.lock` → yarn, otherwise npm); if that PM is not on the user's `PATH`, fall back to the first of `bun`, `yarn`, `npm` that is. If none are installed, fail with a clear message (or skip with `--skip-install`).
4. Load the extension manifest from source.
5. Create or update `installed_extension_sources`.
6. If running inside a project, create or enable a project-scoped `extension_instances` row via the API.
7. Run diagnostics.
8. Print installed extension metadata and project enablement state.

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

The API auto-installs a configured list of default extensions on first project create using the same install primitive (no CLI). Each entry is either a named extension (resolved from the Prompt Studio repo) or a local folder path — the latter is useful for dev environments.

### Default extensions config

The list lives in `pstdio-api` config:

```ts
export type DefaultExtensionEntry =
  | string
  | {
      source: string;          // named extension OR local folder path
      installName?: string;    // override install folder name (== --name)
      skipInstall?: boolean;   // skip bun install (== --skip-install)
      force?: boolean;         // replace existing install (== --force)
    };

export type DefaultExtensionsConfig = {
  defaultExtensions: DefaultExtensionEntry[];
};
```

Resolution rule (same as the CLI): if `source` starts with `./`, `../`, `/`, or `~/` it is a local path; otherwise it is a named extension resolved against `https://github.com/pufflyai/prompt-studio` at `extensions/<name>`.

Production default:

```ts
export const defaultExtensions: DefaultExtensionsConfig = {
  defaultExtensions: ["pstdio-core-skills", "pstdio-core-templates"],
};
```

Dev override (e.g. `bun run pstdio:local:add-dev` injects this so first project create installs from the monorepo):

```ts
{
  defaultExtensions: [
    { source: "./extensions/pstdio-core-skills",    skipInstall: true },
    { source: "./extensions/pstdio-core-templates", skipInstall: true },
  ],
}
```

Override mechanism: the API exports the config object as a const. An env var `PSTDIO_DEFAULT_EXTENSIONS` (JSON) overrides it when set, so dev scripts can inject local entries without editing source.

## Project Toggles

Project-level commands:

```bash
pstdio extensions list
pstdio extensions enable pstdio.planner
pstdio extensions disable pstdio.planner
pstdio extensions remove pstdio.planner
pstdio extensions check
```

Semantics:

| Command   | Effect                                                                               |
| --------- | ------------------------------------------------------------------------------------ |
| `add`     | Installs source under `~/.pstdio/extensions` and auto-enables for the current project|
| `enable`  | Enables an installed extension for the current project                               |
| `disable` | Stops loading it for the current project; keeps config/storage/preferences/artifacts |
| `remove`  | Removes the project-scoped extension instance; does not delete installed source      |
| `check`   | Runs extension loading and registry diagnostics                                      |

If a project needs a modified variant, copy the source and add/enable the copy:

```txt
~/.pstdio/extensions/planner
~/.pstdio/extensions/planner-custom
```

---

# Runtime and Live Reload

Installed extension source is live-reloaded from:

```txt
~/.pstdio/extensions/<install-name>
```

The extension runtime should watch source files and invalidate project runtimes that have enabled the changed extension.

Live reload should update:

```txt
commands
middlewares
hooks
schedules
slots
views
routes
navigation
settings
templates
skills
themes
fileIconThemes
harnesses
diagnostics
```

Live reload should not delete or reset:

```txt
extension storage
template preferences
skill preferences
schedule state
project extension config
repo artifacts
```

If reload fails:

- The extension should be marked unhealthy in diagnostics.
- The failed source should be reported by `pstdio extensions check`.
- Existing project storage and preferences should remain intact.
- The runtime may keep the last valid normalized metadata where safe, but must clearly report that the current source failed to load.

---

# Relationships

- `installed_extension_sources` -> `extension_instances`: one-to-many.
- `projects` -> `extension_instances`: logical one-to-many for rows with `scope_type = "project"`.
- `extension_instances` -> `extension_kv` / `extension_collection_items`: one-to-many through `extension_instance_id`.
- `extension_instances` -> `extension_template_preferences`: one-to-many.
- `extension_instances` -> `extension_skill_preferences`: one-to-many.
- `extension_instances` -> `extension_schedule_state`: one-to-many if schedule state is persisted.
- `templates` -> `files`: existing relationship remains for non-extension project-owned templates.
- `skills` -> `files`: existing relationship remains for non-extension project-owned skills.
- Extension default templates/skills -> package/source assets: templates are source-editable through dashboard/API, skills are edited through installed source files.
- Workspaces -> anchors: v2 supports many anchors, including tickets, sessions, docs, and extension resources.
- Activity -> resource refs: target/related resources should be soft references so historical activity survives deleted extension state.

---

# Migrations

- Add installed extension source storage.
- Add scope-aware extension instance/config storage.
- Add live reload diagnostics cache.
- Add extension KV and extension collection item storage.
- Add extension template preference storage.
- Add extension skill preference storage.
- Add optional extension schedule state storage. Deferred — lands when the scheduler runs commands.
- Broaden activity resource references to use `ResourceRef`.
- Add workspace `type` and `anchors_json` columns while retaining current workspace columns. Workspace `state_json` is deferred until an extension declares a non-kernel workspace type.
- Add session `anchors_json` column for non-workspace relations; keep `workspace_sessions` for kernel workspace↔session linkage.
- Add repo context support for command execution and scheduled repo-scoped commands.
- Add artifact mount namespace enforcement under `.pstdio/<namespace>`.
- Add sync coverage for new extension tables in CLI and dashboard sync collections.
- Cut current action API call sites over to extension command endpoints.
- Replace pre/post command concepts with middleware and command lifecycle events.
- Move current ticket tables behind planner-owned services before changing their physical schema.
- Preserve/import current `.pstdio/tickets/<shorthand>/ticket.md` into `.pstdio/planner/tickets/...`.

---

# Invariants

- Installed extension source lives under the Prompt Studio user root by default:

  ```txt
  ~/.pstdio/extensions/<install-name>
  ```

- Projects enable or disable installed extension sources.
- Disabling an extension does not delete extension storage, config, preferences, schedule state, or artifacts.
- Removing an extension instance does not delete installed source.
- Purging extension data must be explicit.
- Extension ids are unique per project.
- Extension namespaces are unique per project.
- Canonical CLI paths are scoped by namespace:

  ```txt
  pstdio <namespace> ...
  ```

- All commands are visible in the command panel by default unless `commandPanel: false`.
- Commands do not own a static `target`; resource context comes from invocation context.
- Middleware can modify params or reject command execution.
- Hooks observe events and cannot block command execution.
- Middleware order is not guaranteed in v1.
- Events are not declared in `defineExtension`; event refs may be exported from owning contract packages for type safety.
- Artifact mounts are normalized and cannot escape:

  ```txt
  .pstdio/<namespace>/
  ```

- Extension storage is scoped by extension instance; project-owned storage also carries `project_id`.
- Extension templates and skills are edited through installed extension source files; the dashboard/API template editor writes extension template content back to those files.
- Project-specific template and skill changes require a copied extension source with a different extension `id` and `namespace`.
- Slot context is owned by the surface owner and exposed through that owner’s contract package.
- The SDK kernel exports must stay workflow-agnostic and must not import from extension packages.
- Extension-specific contracts belong to the owning extension package.
- The API service is the only DB connection owner. CLI, dashboard, future TUI, and extension adapters use API/SDK calls for schema-backed project state.

---

# Deferred Decisions

These are intentionally not locked in for v1:

- Middleware ordering/dependencies.
- Whether schedule state is always durable or only durable when users override schedule defaults.
- Whether `installed_extension_sources` lives in the project DB, a user-root DB, or a user-root metadata file exposed through API services.
- Exact update/diff behavior for source-installed extensions.
- Durable event log semantics beyond existing activity records.
- Marketplace/cloud trust and permissions model.
