# Extensions

Prompt Studio extensions are TypeScript packages that add project workflow behavior, dashboard UI, packaged assets, and provider integrations.

Extensions are installed into the scope declared by `package.json` `pstdio.scope`. User-scoped extensions default to `~/.pstdio/extensions/<install-name>/`; repo-scoped extensions live under `<repo>/.pstdio/extensions/<install-name>/`. User-scoped sources can be enabled in multiple projects with project-specific settings and storage.

## Product Model

An extension has three layers:

| Layer | Owner | Purpose |
| ----- | ----- | ------- |
| Package source | Extension author | `package.json`, `extension.ts`, webviews, templates, skills, themes, and support files. |
| Extension runtime | Prompt Studio API | Loads packages, validates manifests, executes commands, delivers events, scopes storage, and emits diagnostics. |
| Dashboard host | Prompt Studio dashboard | Resolves targets into menus, area trees, views, settings panels, and renderers. |

Extension identity is package metadata, not code metadata. `package.json` provides `publisher`, `name`, `version`, `main`, and `engines.pstdio`; `defineExtension()` exports only contributions.

## What Extensions Can Add

- Commands exposed to the CLI, dashboard menus, command palette, schedules, automations, or other commands.
- Middleware that runs before commands and can continue, patch params, replace invocation data, or reject.
- Hooks that observe product events and command lifecycle events after they happen.
- Cron schedules that invoke extension or host commands.
- Dashboard routes, sidebar navigation, views, settings panels, and renderers.
- Templates, skills, themes, file icon themes, and custom template types.
- Artifact mounts for safe repo-local files under `.pstdio/<package-name>/`.
- Workspace type and harness providers for deeper runtime integrations.
- Install and upgrade lifecycle work through `initialSetup` and `migrate`.

## Automation Model

Commands are the unit of work. Middleware protects or reshapes command execution before a command handler runs. Hooks react after events are emitted.

Use middleware when the extension needs to block or modify an operation:

- validate a status transition before it is accepted
- fill missing command params from project context
- reject a command with a user-facing reason

Use hooks when the extension should react to something that already happened:

- update a ticket after a session starts
- remove worktrees after a ticket is archived
- create a follow-up session after an attempt status changes
- record activity or show notifications for command lifecycle events

## Dashboard UI Model

The implemented dashboard UI model uses host-owned workbench targets. Extensions attach menus, tree items, views, and settings panels to targets such as `workbench.top.actions`, `workbench.commandPalette`, `workbench.left.tree`, and `workbench.settings`.

Targets describe the dashboard surface. Optional `when` expressions restrict visibility by active mode, command source, active resource type, or active resource metadata.

## Lifecycle

1. A package is installed into its declared user or repo extension root.
2. A project enables the installed source and stores project-scoped extension settings.
3. The API reads `package.json` before importing the entry module.
4. The API imports `extension.ts`, validates contributions, and records diagnostics.
5. Commands, middleware, hooks, schedules, settings, assets, and dashboard UI metadata become available for that project.
6. The dashboard requests extension UI metadata and resolves target contributions into host UI.

## Docs

- [Extension API](./pstdio-extension-api.md)
- [Extension runtime loader](../../architecture/extensions-runtime.md)
- [Dashboard UI attachments](./workbench-attachments.md)
- [Extension modes](./modes-and-layout.md)
- [Cookbook](./cookbook.md)
