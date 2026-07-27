---
name: create-pstdio-extension
description: "Create or edit a Prompt Studio extension. Use when asked to add or change extension behavior, user actions, automation, project or workspace workflows, templates, skills, custom pages, native resource editors, resource file trees, settings UI, themes, artifact storage, workspace providers, agent providers, or extension validation."
metadata:
  version: 0.0.1
---

# create-pstdio-extension

## Workflow

1. Identify the target extension.
   - First-party extensions live under `extensions/<name>/`.
   - Repo-local extensions live under `<repoRoot>/.pstdio/extensions/<name>/`.
   - Installed editable extensions live under `$PSTDIO_HOME/extensions/<install-name>/` or `~/.pstdio/extensions/<install-name>/`.
   - Use [references/scope.md](references/scope.md) to choose repo-local vs user scope before scaffolding new files.
   - Inspect the target `package.json`, `extension.ts`, tests, and nearby extension patterns before editing.
2. Choose the contribution surface.
   - Use commands for user-triggered operations from the CLI, dashboard menus, command palette, schedules, or other commands.
   - Use middlewares to validate, reject, or rewrite command invocations before a command runs.
   - Use hooks to react to project, ticket, workspace, worktree, git, session, attempt-status, or command lifecycle events.
   - Use schedules for cron-triggered command execution.
   - Use templates, skills, themes, file icon themes, and template types for packaged static catalog assets.
   - Use kanban renderers for Planner-style native dashboard lists or boards. Project-sidenav entries are created from `kanbanRenderers`; do not add a `treeItems` entry with `action.kind === "kanbanRenderer"`.
   - Use `fileRenderers` plus `views` for native resource file content such as markdown, code, and image previews.
   - Use `treeRenderers` plus `views` for native workbench trees such as resource files, outline, or navigation panels.
   - Use resource `modes` and mode layouts to open or pin native resource views. Each view must bind exactly one of `webview`, `treeRenderer`, or `fileRenderer`.
   - Use routes plus `treeItems` for custom webview pages in the project sidenav, not for native resource detail screens. Route tree-item actions reference the route path, not the normalized route id.
   - Use views, settings panels, activity renderers, and session anchor renderers for dashboard UI that is not project-sidenav navigation.
   - Use artifact mounts for files under `.pstdio/<extension-package-name>/`.
   - Use Harnesses and workspace types only when adding a new execution or workspace provider.
3. Implement the smallest useful extension change.
   - Keep identity in `package.json`; do not add identity fields to `defineExtension()`.
   - Export a single default `defineExtension({ ... })` value from `extension.ts`.
   - Use `packageAsset()` for every shipped file or directory asset.
   - Keep package asset paths relative and inside the extension package.
   - Prefer typed refs from `commandRef`, `commandsOf`, `eventRef`, and kernel events over string ids when possible.
4. Test the change following the repo's testing conventions.
   - For behavior changes, add or update the tests that cover the new behavior.
   - Put tests next to the behavior they cover.
   - Do not add tests for docs-only, config-only, generated wording, or UI-only changes.
5. Validate the extension.
   - Read [references/validation.md](references/validation.md) for commands and smoke-test expectations.
   - Do not use `--skip-install` for user/global install smoke tests. Installed extensions must have package-local dependencies.
   - Run focused tests first, then your project's full validation command before handoff unless the change is documentation-only.
   - If bundled runtime artifacts changed, reinstall the extension and re-run `pst extensions check`.
6. Add a changeset when changing released extension source or assets.

## References

- [references/extension-api.md](references/extension-api.md) - package manifest, contribution surfaces, ids, context APIs, and asset rules.
- [references/examples.md](references/examples.md) - compact examples for common extension use cases.
- [references/scope.md](references/scope.md) - repo-local vs user extension source selection.
- [references/validation.md](references/validation.md) - typecheck, install, runtime, package, and dashboard validation guidance.
