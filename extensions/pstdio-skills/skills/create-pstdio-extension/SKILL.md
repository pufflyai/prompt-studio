---
name: create-pstdio-extension
description: "Create or edit a Prompt Studio extension. Use for extension commands, hooks, schedules, templates, skills, pages, native editors, file trees, settings, themes, artifact storage, workspaces, agent harnesses, and validation."
metadata:
  version: 0.0.5
---

# Create a Prompt Studio extension

For a new extension, follow the public walkthrough first: [Write an extension](https://prompt.studio/docs/guides/extensions/authoring/). It builds a working tool with a command, a table, a page, and an install. Then return here for each decision below. The [routing index](references/extension-api.md) links the maintained contract for every API.

## Workflow

1. **Check versions.** Read the host's app version in **Help** in the dashboard, and run `pst --version`. `pst extensions check` reports the API version of the `pst` you ran, not the host's. Compare the host's extension API version with the SDK installed in the extension folder. Choose only APIs that this host supports, and declare the lowest `engines.pstdio` range your code needs. See [Check versions before choosing an API](references/extension-api.md#check-versions-before-choosing-an-api) and [API versioning](https://prompt.studio/docs/references/extensions/api-versioning/).
2. **Find or choose the source.** Edit the reusable source, never an installed copy. Choose user or repo scope before you create files. See [Scope and source location](references/scope.md) and [Installing and updating](https://prompt.studio/docs/references/extensions/manifest-and-installation/#installing-and-updating). For an existing extension, read its `package.json`, `extension.ts`, tests, and nearby patterns before editing.
3. **Choose the contribution.**
   - Commands do the work. Expose them with `cli: true` so people and agents use the same action. See [Make actions CLI-ready](https://prompt.studio/docs/guides/extensions/cli-ready-actions/).
   - Use middlewares to check or change a command call before it runs, hooks to react to events, and schedules for cron. See [Lifecycle automation](https://prompt.studio/docs/references/extensions/lifecycle-automation/).
   - Use `ctx.automation.enqueue(...)` for work that outlives a request. See [Durable work](https://prompt.studio/docs/references/extensions/durable-automation/).
   - Use `resourceKinds` for domain resource identity and resource menus.
   - Use `views` for table, board, tree, controls, file, and webview bodies; `pages` for routed screens; `navigationItems` and `navigationTrees` for the sidebar; `viewMenus` and `placements` for attached and mode-wide panels. Choose with [Pages and panels](references/pages.md).
   - Use templates, skills, themes, and file icon themes for packaged static assets.
   - For workflow states on a board, return enum attributes from the collection query and own the editor through commands and a settings panel. Do not add `statuses` contributions; they are deprecated in 0.43.x and removed on `main`. See [Workflow status migration](https://prompt.studio/docs/references/extensions/workflow-status-migration/).
   - Add harnesses and workspace types only for a new agent or workspace provider.
   - Start from a typechecked example in [Examples](references/examples.md).
4. **Store data in the right place.** Structured data goes in `ctx.storage`; extension-owned files go under `.pstdio/extension-storage/<publisher>.<name>/`. Read [Storage results and writes](references/extension-api.md#storage-results-and-writes) and [Storage and workspace APIs](references/host-storage-and-workspaces.md). Save first, then emit the change event, then return the saved value.
5. **Wire native actions and navigation.** Toolbar, row, and selection actions call commands. Row and selection actions pass `rowId` or `rowIds`; `onRowActivate` receives the `row`. See [Native actions](references/native-actions.md) and [Table and board actions](references/extension-api.md#table-and-board-actions-receive-ids-activation-receives-the-row). Request navigation with `ctx.navigation.open(target)` and give every target an explicit page or panel.
6. **Use a webview only when native views cannot express the content.** Read [Webviews](references/webviews.md).
   For typed clients, host props, structured errors, query refresh, outcomes, and resource pages, read [Client contracts](references/client-contracts.md). These are SDK 0.44 APIs on `main`; check the installed SDK before you use them.
7. **Implement the smallest useful change.**
   - Keep identity in `package.json`. Export one default `defineExtension({ ... })` from `extension.ts`.
   - Use `packageAsset("./path", import.meta.url)` for every shipped file. Keep paths inside the package.
   - Use the refs returned by `define*` helpers inside one extension. For cross-extension calls, import the provider's public refs.
8. **Test and validate.** Write a focused test for new behavior. Then run only the checks that prove the change: see [Validation](references/validation.md). Use `pst extensions dev <absolute-source>` from the linked project while you work, and `pst extensions add <absolute-source> --force` for the final install test. Do not run a whole monorepo suite unless the user or the project's rules ask for it.
9. **Release notes.** If the project uses changesets or a changelog for released extensions, add an entry.

## Skills shipped by an extension

An extension's skills come from its source folder, such as `skills/<skill>/SKILL.md`. Agent folders such as `.agents/skills/` or `.claude/skills/` hold installed copies. Edit the source skill, then reinstall the extension or let `pst extensions dev` refresh it.

Installed skill folders are derived copies. Automatic workspace sync updates only files that Prompt Studio wrote and that are still unchanged; it keeps edited files and same-name files it did not write. Delete a kept file to let the next sync write the current version. `pst agents install-skills <agent-id>` installs only missing skill folders and keeps existing ones. `pst agents install-skills <agent-id> --force` replaces the folder of each enabled skill with the source and discards local edits in it. Move any edits you want to keep into the source skill first.

Links inside a skill must work after the folder is copied alone. Link files inside the skill folder with relative paths, and link central documentation with public `https://prompt.studio/docs/` URLs.

## References

- [Extension API routing index](references/extension-api.md): version checks, where each contract lives, and offline essentials.
- [Scope and source location](references/scope.md): source versus installed copies, user or repo scope, installing.
- [Storage and workspace APIs](references/host-storage-and-workspaces.md): data, files, harness state, and workspaces.
- [Pages and panels](references/pages.md): composition, navigation, closing, and sidenav levels.
- [Native actions](references/native-actions.md): toolbar commands and command-backed choices.
- [Webviews](references/webviews.md): bounded custom content, typed commands, and shared state.
- [Examples](references/examples.md): typechecked examples for common tools.
- [Validation](references/validation.md): targeted checks, check modes, and result shapes.
