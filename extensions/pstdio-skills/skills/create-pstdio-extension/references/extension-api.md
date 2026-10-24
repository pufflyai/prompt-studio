# Extension API routing index

Use this page to find the maintained contract for each authoring decision. The public pages below are the authority for behavior. The type declarations in the `@pstdio/sdk` package installed next to your extension are the authority for exact signatures. The offline essentials at the end cover rules that agents often get wrong.

## Check versions before choosing an API

Three version numbers matter. They can differ, and a package number does not tell you the API version.

| Number | What it describes | How to read it |
| --- | --- | --- |
| App or CLI version | The Prompt Studio release that runs the host | **Help** at the bottom of the dashboard sidebar shows the running host; `pst --version` shows the `pst` you ran |
| SDK package version | The `@pstdio/sdk` package your extension compiles against | `version` in `node_modules/@pstdio/sdk/package.json` |
| Extension API version | The contract a host accepts in `engines.pstdio` | `pst extensions check` prints the version of the `pst` you ran; the SDK exports its own as `EXTENSION_API_VERSION` |

Before you write code:

1. Read the host's app version in **Help** at the bottom of the dashboard sidebar. The [versions table](https://prompt.studio/docs/references/extensions/api-versioning/#versions-in-current-releases) maps it to an extension API version; for example, 0.43.1 provides API 0.1.6.
2. Run `pst --version`. If it differs from the host's app version, `pst` checks use a different API version than the host does.
3. Compare with `EXTENSION_API_VERSION` from the SDK installed next to your extension. If it is newer than the host's API, install the SDK release that matches the host, such as `@pstdio/sdk@0.43.1`, or update Prompt Studio. Do not use an API the host does not have.
4. Declare `engines.pstdio` as a caret range that starts at the lowest API version your code needs, such as `^0.1.0`. Never widen the range only to silence a check. A range is a promise that the extension works on that API.

In `pst extensions check --json`, `versions.extensionApi` is always the API version of the `pst` you ran, never the host's. A source check compares your range with that version. After an install, `pst extensions check` asks the host, which checks the range with its own version; trust its `extension_manifest_unsupported_api_version` diagnostic. [App, SDK, and extension API versions](https://prompt.studio/docs/references/extensions/api-versioning/#app-sdk-and-extension-api-versions) explains how to align them.

### APIs that depend on the version

| API | Availability | On an older host |
| --- | --- | --- |
| `ctx.storage.collection(name)` | Every 0.1 and 0.2 host. Deprecated from API 0.2.0. | Use it. |
| `ctx.storage.records`, `ctx.storage.assets`, `client.assets` | API 0.2.0 and newer. Published 0.1.x SDKs do not have them. | Use `ctx.storage.collection`. |
| `ctx.extensionFiles` root | API 0.1: `.pstdio/ext/<publisher>.<name>/`. API 0.2 (0.44, 0.45): `.pstdio/extension-storage/<package-name>/.publishers/<publisher>/`. From 0.46: `.pstdio/extension-storage/<publisher>.<name>/`. | Use relative paths only; the methods are the same. |
| `statuses` contributions (`defineStatuses`) | Deprecated from API 0.1.3. Removed on `main`, so the release after 0.43.x no longer has it. | Do not add new ones. Return enum attributes from the query instead. |
| Setting `options` loaded from a command | API 0.1.2 and newer. | Use fixed `enum` choices. |

[API versioning](https://prompt.studio/docs/references/extensions/api-versioning/) explains ranges and breaking changes. [Scoped checks and versions](https://prompt.studio/docs/references/extensions/manifest-and-installation/#scoped-checks-and-versions) explains what each check compares.

## Route each decision

| Decision | Public contract | Bundled help |
| --- | --- | --- |
| Build a first working extension | [Write an extension](https://prompt.studio/docs/guides/extensions/authoring/) | [Examples](examples.md) |
| Package fields, IDs, and `engines.pstdio` | [Package manifest](https://prompt.studio/docs/references/extensions/manifest-and-installation/#package-manifest), [IDs and scopes](https://prompt.studio/docs/references/extensions/manifest-and-installation/#ids-and-scopes) | This page |
| Where the source lives, user or repo scope, installing | [Installing and updating](https://prompt.studio/docs/references/extensions/manifest-and-installation/#installing-and-updating), [Developing a repo-scoped extension](https://prompt.studio/docs/references/extensions/manifest-and-installation/#developing-a-repo-scoped-extension) | [Scope and source](scope.md) |
| Commands, parameters, and CLI parity | [Commands](https://prompt.studio/docs/references/extensions/command-and-process-api/#commands), [CLI contributions](https://prompt.studio/docs/references/extensions/command-and-process-api/#cli-contributions), [Make actions CLI-ready](https://prompt.studio/docs/guides/extensions/cli-ready-actions/) | This page |
| Choices loaded by a command, toolbar actions | [Command-backed choices](https://prompt.studio/docs/references/extensions/command-and-process-api/#command-backed-choices), [Native view toolbar actions](https://prompt.studio/docs/references/extensions/contribution-api/#native-view-toolbar-actions) | [Native actions](native-actions.md) |
| Middleware, hooks, events, and schedules | [Middlewares and hooks](https://prompt.studio/docs/references/extensions/command-and-process-api/#middlewares-and-hooks), [Lifecycle automation](https://prompt.studio/docs/references/extensions/lifecycle-automation/), [Automation cookbook](https://prompt.studio/docs/guides/extensions/automation/) | |
| Long-running work | [Durable work](https://prompt.studio/docs/references/extensions/durable-automation/) | |
| Structured data | [Save related records](https://prompt.studio/docs/guides/sdk/storage/), [Grouped storage](https://prompt.studio/docs/references/sdk/storage/), [Data migrations](https://prompt.studio/docs/references/extensions/data-migrations/) | [Storage and workspaces](host-storage-and-workspaces.md) |
| Extension-owned files | [Extension file storage](https://prompt.studio/docs/guides/extensions/extension-storage/), [Artifact mounts and storage](https://prompt.studio/docs/references/extensions/webview-and-storage-api/#artifact-mounts-and-storage) | [Storage and workspaces](host-storage-and-workspaces.md) |
| Tables, boards, trees, controls, and files | [Dashboard UI contributions](https://prompt.studio/docs/references/extensions/contribution-api/#dashboard-ui-contributions), [Views: filter, sort, and display](https://prompt.studio/docs/references/extensions/contribution-api/#views-filter-sort-and-display) | This page |
| Refresh after a change | [Renderer edit and refresh](https://prompt.studio/docs/references/extensions/renderer-edit-refresh-lifecycle/) | This page |
| Pages, panels, and navigation | [Workbench composition](https://prompt.studio/docs/references/extensions/contextual-workbench-composition/), [Navigation and layout state](https://prompt.studio/docs/references/extensions/navigation-and-layout-state/), [Sidenav levels](https://prompt.studio/docs/references/extensions/contribution-api/#sidenav-levels), [Workbench cookbook](https://prompt.studio/docs/guides/extensions/workbench-cookbook/) | [Pages and panels](pages.md) |
| Modes and chrome | [Modes and layout](https://prompt.studio/docs/references/extensions/modes-and-layout/) | [Pages and panels](pages.md) |
| Custom UI in a webview | [Webview client](https://prompt.studio/docs/references/extensions/webview-and-storage-api/#webview-client), [Package assets](https://prompt.studio/docs/references/extensions/webview-and-storage-api/#package-assets) | [Webviews](webviews.md) |
| Extension settings | [Settings](https://prompt.studio/docs/references/extensions/contribution-api/#settings) | |
| Notifications | [Notifications](https://prompt.studio/docs/references/extensions/notifications/) | |
| Workflow states on a board | [Workflow status migration](https://prompt.studio/docs/references/extensions/workflow-status-migration/) | |
| Agent harnesses | [Harness command API](https://prompt.studio/docs/references/extensions/harness-commands/), [Agents and harnesses](https://prompt.studio/docs/guides/concepts/agents/) | |
| SDK methods | [Method reference](https://prompt.studio/docs/references/sdk/api/) | |
| Validate | [Smoke checks](https://prompt.studio/docs/guides/extensions/smoke-checks/) | [Validation](validation.md) |

## Offline essentials

### Package and entry

- `package.json` needs `name`, `version`, `publisher`, `main`, `type: "module"`, and `engines.pstdio`. The extension ID is `<publisher>.<name>`. Use lowercase kebab-case for `name`.
- `extension.ts` has one default export: `defineExtension({ ... })`. Do not put `id`, `name`, `version`, or other identity fields in it.
- Local contribution IDs are lowercase kebab-case segments joined by dots, such as `ticket-status.create`. In package `bookmarks`, command `add` becomes `pst bookmarks add`, and command `ticket-status.create` becomes `pst bookmarks ticket-status create`.
- Use `packageAsset("./path", import.meta.url)` for every shipped file. The path must stay inside the package.

### Commands are the single entry point

A command with `cli: true` is also a CLI command. Toolbar actions, row actions, menus, and the palette call the same command. Return JSON data. A person and an agent then use one code path. Check both entry points: run `pst <name> <command> --help`, call the command from the CLI, and use the same action in the dashboard.

### Storage results and writes

These rules hold for `ctx.storage.collection(name)`, the API every current host supports.

- `list()` returns a plain array of items: `TItem[]`. It is not `{ items }` or `{ rows }`. Map it to rows yourself in a table `query`.
- `get(id)` returns the item or `undefined`.
- `put(id, value)` creates or replaces. Use it for new items.
- `update(id, value)` replaces only an existing item. It throws if the item was deleted, so a late edit cannot bring a deleted item back. Use it for edits. Do not check `get` and then call `put`; another writer can delete the item between the two calls.
- For mounted text files, `writeText` creates or replaces and `updateText` changes only an existing file.

On API 0.2.0 and newer hosts, prefer `ctx.storage.records`. Read a record, keep its revision, and commit related changes as one group. Read the [save workflow](https://prompt.studio/docs/guides/sdk/storage/) before you use it.

### Save first, then emit the event

1. Validate the input.
2. Write to storage and wait for the write to finish.
3. Emit the change event with `ctx.events.emit(eventRef, payload)`.
4. Return the saved value.

Never emit before the write succeeds. A failed write must not emit. Views that list the event in `refreshEvents` run their `query` again; webviews subscribe and read again. The event payload is a signal, not the data.

### Table and board actions receive IDs, activation receives the row

| Callback | What the host passes |
| --- | --- |
| `rowActions` command (data table and kanban) | Command input `{ rowId }`: the row's `id` string |
| `selectionActions` command (data table, with `selectionMode: "multiple"`) | Command input `{ rowIds }`: an array of row `id` strings |
| `onRowActivate(ctx, { row })` | The whole row object: `{ id, values, resource? }` for a table |

Declare `rowId: params.text({ required: true })` or `rowIds: params.json<string[]>()` on the action's command, and load the item by that ID. Do not expect `row` or `values` in an action command. A data table runs the action command at once. On a kanban board, an action command that declares parameters first opens its form, with `rowId` filled in. Row activation only requests navigation with `ctx.navigation.open(target)` and returns nothing.

### Navigation and removal

- Commands and callbacks request navigation with `ctx.navigation.open(target)`. A returned target is only data and does nothing.
- After deleting a resource, call `await ctx.resources.removed({ type, id })` so open views close their bindings.
- The host never guesses a page from a resource kind. Give every target an explicit page or panel.

### Each project has its own data

`ctx.storage` belongs to the extension in the current project. Another project that enables the same extension sees different data. A unit test with the SDK's memory storage cannot show this. To check it, link two real project folders, enable the extension in both, add an item in one, and list in both:

```sh
pst <name> list --project-id <first-project-id> --json
pst <name> list --project-id <second-project-id> --json
```

Use a scope from `ctx.storage.scope(...)` only for data owned by a resource or another named group inside the same project.
