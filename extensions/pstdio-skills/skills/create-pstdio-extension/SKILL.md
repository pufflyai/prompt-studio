---
name: create-pstdio-extension
description: "Create or edit a Prompt Studio extension. Use for extension commands, hooks, schedules, templates, skills, pages, native editors, file trees, settings, themes, artifact storage, workspaces, agent harnesses, and validation."
metadata:
  version: 0.0.2
---

# Create a Prompt Studio extension

## Workflow

1. Identify the target extension.
   - First-party extensions live under `extensions/<name>/`.
   - Repo-local extensions live under `<repoRoot>/.pstdio/extensions/<name>/`.
   - Installed editable extensions live under `$PSTDIO_HOME/extensions/<install-name>/` or `~/.pstdio/extensions/<install-name>/`.
   - Use [references/scope.md](references/scope.md) to choose repo-local vs user scope before scaffolding new files.
   - Inspect the target `package.json`, `extension.ts`, tests, and nearby extension patterns before editing.
2. For UI work, choose the surface first. Start at the top of this ladder and move down only when the shape above cannot express the tool:
   - Items of a kind users browse and open (tickets, files, runs): `resourceKinds` plus a page that binds the kind.
   - A screen inside the project (static panels, resource tabs, or both): a `page`. Any prompt shaped like "a screen with a table, a file tree, and an editor" is one page with static slots, a `many` bound slot, and bindings. Never build it from a mode, placements, or an anchor resource.
   - A helper panel that follows a view everywhere it renders: a `viewMenu`.
   - A panel that persists across every page in a mode (terminal, sessions, logs): a `placement` into that mode.
   - A tool that changes the bench itself (which regions exist): a `mode` with static view placements. Rare; zen mode is the test.
   - Configuration, not a tool: `settingsPanels` / `settingsSections`.
   There is no "single view as a screen" rung; a one-panel tool is a page with one static unclosable slot. A resource is never a navigation destination: callers target a page, and the resource travels as an argument. The canonical decision guide is `.pstdio/docs/extensions/choosing-a-ui-surface.md` in the Prompt Studio repository; the page API is in [references/extension-api.md](references/extension-api.md).
3. Choose the non-UI contribution type.
   - Use commands for user-triggered operations from the CLI, dashboard menus, command palette, schedules, or other commands.
   - Use middlewares to validate, reject, or rewrite command invocations before a command runs.
   - Use hooks to react to project, workspace, worktree, git, session, or command lifecycle events.
   - Use schedules for cron-triggered command execution.
   - Use templates, skills, themes, file icon themes, and template types for packaged static catalog assets.
   - Use `views` for webview, Kanban, data table, file, tree, and controls bodies. A view never owns geometry, a URL, or a resource kind; pages and placements decide where it renders.
   - Use `navigationItems` for typed page, command, href, or compound navigation actions.
   - Use `statuses` for workflow status providers shared by Kanban views and the host settings editor.
   - Use built-in refs from `workbenchModes`, `workbenchSlots`, `workbenchCommands`, and `workbenchPages` when targeting host modes, slots, commands, and native screens.
   - Use artifact mounts for files under `.pstdio/<extension-package-name>/`.
   - Use Harnesses and workspace types only when adding a new execution or workspace provider.
4. Implement the smallest useful extension change.
   - Keep identity in `package.json`; do not add identity fields to `defineExtension()`.
   - Export a single default `defineExtension({ ... })` value from `extension.ts`.
   - Use `packageAsset()` for every shipped file or directory asset.
   - Keep package asset paths relative and inside the extension package.
   - Use refs returned by `define*` helpers inside one extension. Import public refs from the provider for cross-extension calls. A provider may use `commandRef.forExtension()` once in its public contract module.
5. Test the change following the repo's testing conventions.
   - For behavior changes, add or update the tests that cover the new behavior.
   - Put tests next to the behavior they cover.
   - Do not add tests for docs-only, config-only, generated wording, or UI-only changes.
6. Validate the extension.
   - Read [references/validation.md](references/validation.md) for commands and smoke-test expectations.
   - Use `pst extensions dev <path>` as the primary local authoring loop inside a linked project.
   - Do not use `--skip-install` for user/global install smoke tests. Installed extensions must have package-local dependencies.
   - Run focused tests first. Then run the project's full validation command before handoff unless only documentation changed.
   - If bundled runtime artifacts changed, stop the dev loop, run a production-like `pst extensions add --force`, and re-run `pst extensions check`.
7. Add a changeset when changing released extension source or assets.

## References

- [references/extension-api.md](references/extension-api.md) - package manifest, contribution types, ids, context APIs, and asset rules.
- [references/host-storage-and-workspaces.md](references/host-storage-and-workspaces.md) - harness state, worktree cleanup, workspace identity, and repo file storage.
- [references/examples.md](references/examples.md) - compact examples for common extension use cases.
- [references/scope.md](references/scope.md) - repo-local vs user extension source selection.
- [references/validation.md](references/validation.md) - typecheck, install, runtime, package, and dashboard validation guidance.
