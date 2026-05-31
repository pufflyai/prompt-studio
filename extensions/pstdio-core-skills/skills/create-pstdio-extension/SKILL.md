---
name: create-pstdio-extension
description: "Create or edit a pstdio extension. Use when asked to add or change extension commands, hooks, middlewares, schedules, templates, skills, routes, webviews, settings panels, themes, artifact mounts, workspace types, harnesses, or extension validation."
metadata:
  - version: 0.0.1
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
   - Use routes, views, navigation, settings panels, activity renderers, and session anchor renderers for dashboard UI.
   - Use artifact mounts for files under `.pstdio/<extension-package-name>/`.
   - Use harnesses and workspace types only when adding a new execution or workspace provider.
3. Implement the smallest useful extension change.
   - Keep identity in `package.json`; do not add identity fields to `defineExtension()`.
   - Export a single default `defineExtension({ ... })` value from `extension.ts`.
   - Use `packageAsset()` for every shipped file or directory asset.
   - Keep package asset paths relative and inside the extension package.
   - Prefer typed refs from `commandRef`, `commandsOf`, `eventRef`, and kernel events over string ids when possible.
4. Test with the repo's TDD rules.
   - For behavior changes, write the smallest test first and confirm it fails for the right reason.
   - Put tests next to the behavior they cover.
   - Do not add tests for docs-only, config-only, generated wording, or UI-only changes.
5. Validate the extension.
   - Read [references/validation.md](references/validation.md) for commands and smoke-test expectations.
   - Run focused tests first, then `bun run validate` before handoff unless the change is documentation-only.
   - If bundled runtime artifacts changed, run `bun run scripts/verify-packages.ts`.
6. Add a changeset when changing released extension source or assets.

## References

- [references/extension-api.md](references/extension-api.md) - package manifest, contribution surfaces, ids, context APIs, and asset rules.
- [references/examples.md](references/examples.md) - compact examples for common extension use cases.
- [references/scope.md](references/scope.md) - repo-local vs user extension source selection.
- [references/validation.md](references/validation.md) - typecheck, install, runtime, package, and dashboard validation guidance.
