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
   - Use kanban renderers for Planner-style native dashboard lists or boards. Add a panel for the renderer, then point a `treeItems` panel action at it when it belongs in the project sidenav.
   - Use `fileRenderers` plus `panels` for native resource file content such as markdown, code, and image previews.
   - Use `treeRenderers` plus `panels` for native workbench trees such as resource files, outline, or navigation.
   - A panel declares `supportedRegions` (the docked regions it can occupy) and exactly one body: a `webview` or one native `renderer` reference. A panel never places itself.
   - Use `resourceKinds` to declare a domain resource type and its named slots. A slot is an extension point on the resource; `external: true` slots accept panels from other extensions. A resource kind keeps the plain name you give it, and that same name is the resource `type` your commands return, so pick a name no other extension will claim.
   - Use `resourcePanels` to bind a panel to one resource kind slot. A bare panel id resolves inside your extension; use `<extension>.<id>` for another extension's panel. A resource kind reference works either way, so name the owner when the kind is not yours.
   - Use mode `resources` recipes to place slots and known panels into docked regions, with `required` and `allowedRegions` policy. Use `modePanels` for mode-wide panels and `defaultResource` to enter a mode without a compatible resource.
   - Use `statusItems` for status-surface chrome. Status content is not a panel and takes no part in docked layout.
   - Use routes plus `treeItems` for custom webview pages in the project sidenav, not for native resource detail screens. Route tree-item actions reference the route path, not the normalized route id.
   - Use panels and settings panels for dashboard UI that is not project-sidenav navigation. Use `activityItems` for activity-rail entries.
   - Use artifact mounts for files under `.pstdio/<extension-package-name>/`.
   - Use Harnesses and workspace types only when adding a new execution or workspace provider.
3. Implement the smallest useful extension change.
   - Keep identity in `package.json`; do not add identity fields to `defineExtension()`.
   - Export a single default `defineExtension({ ... })` value from `extension.ts`.
   - Use `packageAsset()` for every shipped file or directory asset.
   - Keep package asset paths relative and inside the extension package.
   - Prefer typed refs from `commandRef`, `eventRef`, and kernel events over string ids when possible.
4. Test the change following the repo's testing conventions.
   - For behavior changes, add or update the tests that cover the new behavior.
   - Put tests next to the behavior they cover.
   - Do not add tests for docs-only, config-only, generated wording, or UI-only changes.
5. Validate the extension.
   - Read [references/validation.md](references/validation.md) for commands and smoke-test expectations.
   - Use `pst extensions dev <path>` as the primary local authoring loop inside a linked project.
   - Do not use `--skip-install` for user/global install smoke tests. Installed extensions must have package-local dependencies.
   - Run focused tests first, then your project's full validation command before handoff unless the change is documentation-only.
   - If bundled runtime artifacts changed, stop the dev loop, run a production-like `pst extensions add --force`, and re-run `pst extensions check`.
6. Add a changeset when changing released extension source or assets.

## References

- [references/extension-api.md](references/extension-api.md) - package manifest, contribution surfaces, ids, context APIs, and asset rules.
- [references/examples.md](references/examples.md) - compact examples for common extension use cases.
- [references/scope.md](references/scope.md) - repo-local vs user extension source selection.
- [references/validation.md](references/validation.md) - typecheck, install, runtime, package, and dashboard validation guidance.
