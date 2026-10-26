# Write an extension

Build a Bookmarks tool with a native table, saved filters, and matching `pst` commands, then install it in a project.

The finished tool saves links, marks them read, filters unread links, and deletes links. People use it from a table in the workbench. Agents use the same commands through `pst`. Each project keeps its own bookmarks.

Every code block on this page is a complete file from the [maintained Bookmarks example](../../../infra/local/extensions/bookmarks/extension.ts). Prompt Studio's checks compare these blocks with that example, and its [tests](../../../infra/local/extensions/bookmarks/extension.p0.test.ts) run against the SDK version below.

## Versions this guide uses

| Part | Version | How to check |
| --- | --- | --- |
| Prompt Studio (`pst`) | 0.43.1 | `pst --version` |
| Extension API | 0.1.6 | `pst extensions check`, run in a linked project without a path, prints `Extension API: 0.1.6` |
| `@pstdio/sdk` | 0.43.1 | The `package.json` below pins it |

The extension API is the contract between your extension and Prompt Studio. It has its own version, separate from the app and the SDK package. See [App, SDK, and extension API versions](../../references/extensions/0014-api-versioning.md#app-sdk-and-extension-api-versions).

These steps are tested with exactly these versions. If `pst --version` prints another version, read [Release differences](#release-differences) first.

## Before you start

You need:

- **Bun 1.4.4 or newer.** The steps use it to install packages, check types, and run tests. If you only have the desktop app, write `BUN_BE_BUN=1 pst` instead of `bun`. For example, `bun install` becomes `BUN_BE_BUN=1 pst install`.
- **The `pst` command.** The desktop app includes it. Without the app, run `bun add --global pstdio@0.43.1`. That package starts `pst` through Node.js, so Node.js must also be on your `PATH`. See [Install Prompt Studio](../getting-started/0001-install.md).
- **Git.** When you create your first project, Prompt Studio downloads its default extensions from GitHub with Git. Your project folder does not need to be a Git repository.

Check them:

```sh
bun --version
pst --version
git --version
```

Each command prints a version number. If `pst` prints `env: node: No such file or directory`, install Node.js or use the desktop app's `pst`.

This guide uses two folders. Keep them separate:

| Folder | What it holds |
| --- | --- |
| `~/bookmarks` | The extension source. You edit files here. |
| `~/my-tools` | A linked project. You install and use the extension here. |

On Windows, use full paths such as `C:\Users\you\bookmarks` wherever this page writes `~/`.

## 1. Create a linked project

A linked project is a folder that Prompt Studio knows about. You install extensions from inside one.

```sh
mkdir -p ~/my-tools
cd ~/my-tools
pst projects create
```

It prints `Opened project "my-tools" (<project-id>) at <path>`. The folder now has `.pstdio/config.json`, which links it to the project. The first project also downloads the default extensions, so it can take a little longer.

If you already have a project, you can use its folder instead of `~/my-tools`. See [Open a project](../getting-started/0002-open-a-project.md) for the dashboard steps.

## 2. Create the package

Create the extension folder outside the project:

```sh
mkdir -p ~/bookmarks/src
cd ~/bookmarks
```

Create `package.json`:

```json file=package.json
{
  "name": "bookmarks",
  "version": "0.1.0",
  "displayName": "Bookmarks",
  "description": "Save links for a project and mark them read.",
  "publisher": "acme",
  "private": true,
  "type": "module",
  "main": "./extension.ts",
  "engines": {
    "pstdio": "^0.1.6 || ^0.2.0 || ^0.3.0"
  },
  "scripts": {
    "lint": "bun check",
    "test": "bun test"
  },
  "dependencies": {
    "@pstdio/sdk": "0.43.1"
  },
  "devDependencies": {
    "@types/bun": "1.4.4",
    "typescript": "6.0.2"
  }
}
```

- `publisher` and `name` form the extension ID, here `acme.bookmarks`. You can use your own publisher name; then also change `extensionId` in `src/bookmarks.ts` in step 3. Each part starts with a lowercase letter and contains only lowercase letters, numbers, and dashes.
- `main` is the entry file.
- `engines.pstdio` lists the extension API versions this extension works with. `^0.1.6` accepts 0.1.6 and later 0.1 releases. `^0.2.0` and `^0.3.0` accept the next two breaking releases. Claim a version only after you run the extension on it.
- `@pstdio/sdk` is pinned to the SDK release that matches your Prompt Studio version.

Create `tsconfig.json`, so the type checker knows the files and Bun's types:

```json file=tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["bun"]
  },
  "include": ["*.ts", "src/**/*.ts"]
}
```

Install the packages and print the API version of the installed SDK:

```sh
bun install
bun -e 'console.log((await import("@pstdio/sdk/extensions")).EXTENSION_API_VERSION)'
```

The second command prints `0.1.6`. If it prints another version, the SDK does not match the Prompt Studio in the table above.

## 3. Store bookmarks

Create `src/bookmarks.ts`. It holds the bookmark type, the change event, and access to saved bookmarks:

```ts file=src/bookmarks.ts
import { type ExtensionStorageApi, eventRef } from "@pstdio/sdk/extensions";

export type Bookmark = { id: string; title: string; url: string; read: boolean };

// The extension ID is "<publisher>.<name>" from package.json.
export const bookmarksChanged = eventRef<{ ids: string[] }>({ extensionId: "acme.bookmarks", id: "changed" });

export const bookmarkStore = (storage: ExtensionStorageApi) => storage.collection<Bookmark>("bookmarks");

export async function setRead(storage: ExtensionStorageApi, id: string, read: boolean) {
  const store = bookmarkStore(storage);
  const bookmark = await store.get(id);
  if (!bookmark) throw new Error(`Bookmark not found: ${id}`);
  const updated = { ...bookmark, read };
  // update() only replaces an existing item. Unlike put(), it never brings back a deleted bookmark.
  await store.update(id, updated);
  return updated;
}
```

- `ctx.storage` is storage that Prompt Studio keeps for this extension in the current project. Another project gets its own empty storage.
- `collection("bookmarks")` is a named set of items. `put(id, value)` creates or replaces an item. `update(id, value)` only replaces an item that still exists, and throws if it was deleted. Use `update` when a missing item means something went wrong.
- `bookmarksChanged` is the event that tells open views to read the bookmarks again. Its `extensionId` must equal `<publisher>.<name>` from `package.json`.

## 4. Add commands

Create `src/commands.ts`. Each command is one operation that the workbench and `pst` share:

```ts file=src/commands.ts
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { type Bookmark, bookmarkStore, bookmarksChanged, setRead } from "./bookmarks";

export const bookmarkParams = {
  title: params.text({ label: "Title", required: true }),
  url: params.text({ label: "URL", required: true }),
};

export const addBookmark = defineCommand({
  id: "add",
  title: "Add bookmark",
  description: "Save a title and URL in this project's bookmarks.",
  cli: true,
  palette: [{ label: "Add bookmark" }],
  params: bookmarkParams,
  async run(ctx, { title, url }) {
    const bookmark: Bookmark = { id: crypto.randomUUID(), title, url, read: false };
    // Save first, then announce the change, so a refreshing view reads the new data.
    await bookmarkStore(ctx.storage).put(bookmark.id, bookmark);
    await ctx.events.emit(bookmarksChanged, { ids: [bookmark.id] });
    return bookmark;
  },
});

export const listBookmarks = defineCommand({
  id: "list",
  title: "List bookmarks",
  description: "Read this project's bookmarks. Use --unread to hide bookmarks you have read.",
  cli: true,
  params: {
    unread: params.boolean({ label: "Only unread" }),
  },
  async run(ctx, { unread }) {
    // list() returns a plain array of the stored values.
    const bookmarks = await bookmarkStore(ctx.storage).list();
    return unread ? bookmarks.filter((bookmark) => !bookmark.read) : bookmarks;
  },
});

export const toggleRead = defineCommand({
  id: "toggle-read",
  title: "Toggle read",
  description: "Mark a bookmark read, or unread if it was read.",
  cli: true,
  params: {
    // A table row action sends the clicked row's ID as rowId.
    rowId: params.text({ label: "Bookmark ID", required: true }),
  },
  async run(ctx, { rowId }) {
    const bookmark = await bookmarkStore(ctx.storage).get(rowId);
    if (!bookmark) throw new Error(`Bookmark not found: ${rowId}`);
    const updated = await setRead(ctx.storage, rowId, !bookmark.read);
    await ctx.events.emit(bookmarksChanged, { ids: [rowId] });
    return updated;
  },
});

export const deleteBookmarks = defineCommand({
  id: "delete",
  title: "Delete bookmarks",
  description: "Delete one or more bookmarks by ID.",
  cli: true,
  params: {
    // A table selection action sends the selected rows' IDs as rowIds.
    rowIds: params.list({ label: "Bookmark IDs", required: true }),
  },
  async run(ctx, { rowIds }) {
    const store = bookmarkStore(ctx.storage);
    for (const id of rowIds) await store.delete(id);
    await ctx.events.emit(bookmarksChanged, { ids: rowIds });
    return { deleted: rowIds };
  },
});
```

- `cli: true` adds the command to `pst`, as `pst bookmarks <id>`. You do not write a separate command-line program.
- `params` declares typed inputs. The dashboard builds forms from them, and `pst` turns them into flags. Names become kebab-case flags: `rowId` becomes `--row-id`. A boolean such as `unread` is `--unread`. A list such as `rowIds` repeats its flag.
- `palette` adds **Add bookmark** to the command palette.
- Each command saves its change first and emits `bookmarksChanged` after. If the event came first, a view could refresh before the new data is saved.
- `list()` returns a plain array of the stored values. It has no wrapper object, and items have no ID unless you store one. That is why each bookmark keeps its own `id`.
- Return the saved state, such as the new bookmark with its ID. A caller can then use the ID in the next command.

## 5. Add the table

Create `src/view.ts`. It shows the bookmarks in a native table and adds a sidebar entry:

```ts file=src/view.ts
import { defineNavigationItem, definePage, defineView, workbenchModes } from "@pstdio/sdk/extensions";
import { bookmarkStore, bookmarksChanged, setRead } from "./bookmarks";
import { addBookmark, bookmarkParams, deleteBookmarks, toggleRead } from "./commands";

export const bookmarkTable = defineView({
  id: "bookmark-table",
  title: "Bookmarks",
  body: {
    kind: "dataTable",
    refreshEvents: [bookmarksChanged],
    columns: [
      { id: "title", label: "Title" },
      { id: "url", label: "URL" },
      { id: "read", label: "Read", type: "boolean" },
    ],
    defaultViews: [
      { id: "all", title: "All" },
      {
        id: "unread",
        title: "Unread",
        filter: { conjunction: "and", rules: [{ attributeId: "read", condition: "is", value: false }] },
      },
    ],
    defaultActiveViewId: "all",
    toolbarActions: [
      {
        id: "add",
        label: "Add bookmark",
        icon: "plus",
        presentation: "primary",
        command: addBookmark.ref,
        input: bookmarkParams,
        submitLabel: "Save",
      },
    ],
    rowActions: [{ id: "toggle-read", label: "Toggle read", icon: "check", command: toggleRead.ref }],
    selectionMode: "multiple",
    selectionActions: [
      { id: "delete", label: "Delete", icon: "trash-2", destructive: true, command: deleteBookmarks.ref },
    ],
    // Activating a row passes the whole row, not a rowId.
    async onRowActivate(ctx, { row }) {
      await setRead(ctx.storage, row.id, true);
      await ctx.events.emit(bookmarksChanged, { ids: [row.id] });
    },
    async query(ctx) {
      const bookmarks = await bookmarkStore(ctx.storage).list();
      return {
        rows: bookmarks.map(({ id, title, url, read }) => ({ id, values: { title, url, read } })),
      };
    },
  },
});

export const bookmarksPage = definePage({
  id: "bookmarks",
  title: "Bookmarks",
  path: "bookmarks",
  icon: "bookmark",
  mode: workbenchModes.project,
  main: { kind: "view", view: bookmarkTable.ref, cardinality: "one" },
  slots: [],
});

export const bookmarksNavigation = defineNavigationItem({
  id: "bookmarks",
  label: "Bookmarks",
  icon: "bookmark",
  owner: workbenchModes.project,
  action: { kind: "page", page: bookmarksPage.ref },
});
```

- `query` reads the bookmarks and returns one row for each. The table applies filters and sorting to the rows you return.
- `refreshEvents` runs `query` again after `bookmarksChanged`. A change made through `pst` appears in an open table without a reload.
- `defaultViews` creates the **All** and **Unread** tabs. **Unread** filters on the `read` column, which `type: "boolean"` marks as true or false. The tabs are saved with the project the first time the table opens, and people can change them later.
- The toolbar action runs the `add` command. Its `input` opens a form with the same fields as `pst bookmarks add`.
- The page gives the table its own address in the project. The navigation item adds **Bookmarks** to the project sidebar.

Each kind of table action passes different inputs:

| Table action | What it receives |
| --- | --- |
| `rowActions` | `rowId`: the ID of the row whose menu was used |
| `selectionActions` | `rowIds`: the IDs of all selected rows |
| `onRowActivate` | `row`: the whole row, with `row.id` and `row.values` |

Row and selection actions run a command, so name its parameters `rowId` and `rowIds` to receive these values. `onRowActivate` is a callback in the view, not a command, so it reads `row.id`.

Create `extension.ts`. It lists everything the extension adds:

```ts file=extension.ts
import { defineExtension } from "@pstdio/sdk/extensions";
import { addBookmark, deleteBookmarks, listBookmarks, toggleRead } from "./src/commands";
import { bookmarksNavigation, bookmarksPage, bookmarkTable } from "./src/view";

export default defineExtension({
  commands: [addBookmark, listBookmarks, toggleRead, deleteBookmarks],
  views: [bookmarkTable],
  pages: [bookmarksPage],
  navigationItems: [bookmarksNavigation],
});
```

Check the types:

```sh
bun run lint
```

It prints `$ bun check` and a result. A type error names the file and line.

## 6. Install it in the project

Install from the project folder, and give the source folder's full path:

```sh
cd ~/my-tools
pst extensions add ~/bookmarks
```

The output starts with:

```txt
Installed extension:
  Id: acme.bookmarks
  Name: bookmarks
  Version: 0.1.0
  Source: <home>/.pstdio/extensions/bookmarks
  Project: enabled for <project-id>
```

In the release after 0.43.x, `pst extensions add .` also works from inside a linked project. On 0.43.1, always give the full path.

`pst` copies the source into Prompt Studio's extension folder, installs its dependencies, checks it, and turns it on for this project. The copy at the `Source:` path, under `<home>/.pstdio/extensions/`, is not your source. Edit `~/bookmarks`, then install again.

If something goes wrong:

- An error that tells you to run `pst extensions add` inside a linked project: you ran it outside `~/my-tools`. Run `cd ~/my-tools` first, or create the project in step 1.
- `An extension is already installed at ...`: you installed it before. Add `--force` to replace the installed copy with your current source. Saved bookmarks are kept.
- A check error names the extension, the contribution, and the field. Fix the source, then install again with `--force`.

While you edit the extension, run the watcher from the project folder instead of reinstalling by hand:

```sh
pst extensions dev ~/bookmarks
```

It checks and reloads the extension each time you save a file. Stop it with Ctrl+C.

## 7. Use it from the command line

Run these commands in `~/my-tools`:

```sh
pst bookmarks --help
pst bookmarks add --title "Prompt Studio" --url https://prompt.studio
pst bookmarks list
```

`--help` lists `add`, `delete`, `list`, and `toggle-read`. `add` prints the new bookmark as JSON, with `"read":false` and its `id`. `list` prints an array that contains it.

Use the ID from `add` with the other commands. Replace `<id>` with that value:

```sh
pst bookmarks toggle-read --row-id <id>
pst bookmarks list --unread
pst bookmarks add --title "Extension docs" --url https://prompt.studio/docs/
```

`toggle-read` prints the bookmark with `"read":true`. `list --unread` no longer shows it.

- A missing flag fails before the command runs, for example `Missing required option: --url`.
- A failed command prints the error and exits with code 1. Toggling a deleted bookmark prints `error: Bookmark not found: <id>`.
- `Unknown arguments: bookmarks` means `pst` does not see the extension in this folder. Run the command in `~/my-tools`, or run `pst extensions add ~/bookmarks --force` there.

Add `--json` to print the full response, which agents and scripts can check. Read `outcome.value` only when `outcome.ok` is true. See [Make actions CLI-ready](0007-cli-ready-actions.md).

## 8. Use it in the workbench

Open the dashboard. Run `pst` in `~/my-tools`, or open the desktop app, then choose **my-tools**. Choose **Bookmarks** in the sidebar.

The table shows the bookmarks you added from the command line. Then try each action:

1. Choose **Add bookmark**, fill in **Title** and **URL**, and choose **Save**. The new row appears.
2. Open a row's **Row actions** menu at the end of the row and choose **Toggle read**. Its **Read** cell changes.
3. Choose the **Unread** tab. Only unread bookmarks remain. Choose **All** to see every bookmark.
4. Double-click an unread row. It is marked read.
5. Select one or more rows with their checkboxes and choose **Delete**. The rows disappear.

Run `pst bookmarks list` again. It shows the changes you made in the table. With the table open, run `pst bookmarks add --title "From the terminal" --url https://example.com`. The row appears without a reload.

If **Bookmarks** is missing from the sidebar, the extension is not on in this project. Run `pst extensions add ~/bookmarks --force` in `~/my-tools`, then reload the page.

## 9. Check persistence and project separation

Reload the page. The bookmarks are still there, because they are saved in the project, not in the page.

Restart Prompt Studio and read them again:

```sh
pst close
pst bookmarks list
```

`pst close` prints `Runtime stopped.` The next command starts Prompt Studio again and prints the same bookmarks.

Create a second project and look at its bookmarks:

```sh
mkdir -p ~/other-tools
cd ~/other-tools
pst projects create
pst bookmarks list
```

A project you create after an install starts with every installed extension turned on, so you do not install Bookmarks again. In a project that existed before the install, turn Bookmarks on in **Settings → Extensions**. The last command prints `[]`. The second project has its own storage, so the bookmarks from `~/my-tools` do not appear. A bookmark added here does not appear in `~/my-tools`. In the dashboard, switch projects with the arrow next to the project name.

## 10. Check the extension

Check the source without installing it:

```sh
pst extensions check ~/bookmarks
```

It prints `Errors: 0` and lists the four commands with their CLI paths. If it reports `extension_import_failed` with `Could not resolve: "@pstdio/sdk/extensions"`, run `bun install` in `~/bookmarks` first. It reports invalid IDs, missing references, unknown icons, and features your Prompt Studio does not support. Run `pst extensions check` without a path to check every installed extension.

To test the commands without Prompt Studio, copy [`extension.p0.test.ts`](../../../infra/local/extensions/bookmarks/extension.p0.test.ts) from the example into `~/bookmarks` and run `bun test`. It uses `@pstdio/sdk/testing`: each test calls a command's `run` with `makeCommandArgs({ storage: createMemoryStorage(), params })`, so the storage lives in memory.

[Smoke checks](0006-smoke-checks.md) explains `pst extensions test`, which opens your pages in a real browser and reports errors.

## Release differences

This page is tested with Prompt Studio 0.43.1. The `main` branch already contains the next breaking extension API, 0.2.0, which ships in the release after 0.43.x. See [Versions in current releases](../../references/extensions/0014-api-versioning.md#versions-in-current-releases).

- API 0.2.0 adds `ctx.storage.records`, which saves a group of related changes at once and refuses writes based on stale data, and `ctx.storage.assets`. Prompt Studio 0.43.1 does not have them.
- This guide saves bookmarks with `storage.collection`, which is the right choice on 0.43.1. API 0.2.0 marks `collection` as deprecated in favor of `storage.records`. It still works there, which is why this extension declares `^0.1.6 || ^0.2.0 || ^0.3.0`. API 0.3 refuses storage records over 256 KiB; a bookmark is far smaller. Move to `storage.records` when you no longer need to support 0.43.1. See [Save related records](../sdk/0003-storage.md).

When your Prompt Studio updates, run `pst extensions check`. If it reports `extension_manifest_unsupported_api_version`, follow the repair it prints.

## Next steps

- Let an agent build the next tool. Prompt Studio Skills, installed in every new project, includes a skill for writing extensions. Run `pst agents setup <agent-id>` in your project, then describe the tool you want.
- Add inspectors, editors, and custom modes with the [Workbench cookbook](0002-workbench-cookbook.md).
- React to commands and events with the [Automation cookbook](0003-automation.md).
- Build a custom page with a webview. See [Webviews and storage](../../references/extensions/0005-webview-and-storage-api.md).
- Look up every contribution in the [extension API reference](../../references/extensions/0001-api.md) and the [manifest rules](../../references/extensions/0002-manifest-and-installation.md).

## Numbered resources

For tools with numbers such as PS-12 or RP-4, declare a resource kind prefix and use
core's resource allocation API. Store the resource UUID and read its current number
from core. Extensions do not keep their own copy or repair numbers after offline
merges. The [resource numbers reference](../../references/sdk/0002-resources.md#resource-numbers)
describes allocation, current identities, aliases, and change events available on
`main` for the release after 0.44.0. The Bookmarks example does not need numbers.
