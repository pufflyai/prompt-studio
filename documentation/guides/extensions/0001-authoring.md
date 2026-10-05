# Write an extension

Build a small Bookmarks tool: a command that saves a link, and a table that lists the saved links.

## Before you start

You need Prompt Studio and a project. See [Install Prompt Studio](../getting-started/0001-install.md) and [Open a project](../getting-started/0002-open-a-project.md).

The commands below use Bun to install packages. If you do not have Bun, use the copy of Bun inside `pst`: put `BUN_BE_BUN=1` in front of the command and write `pst` instead of `bun`. For example, `bun add @pstdio/sdk` becomes `BUN_BE_BUN=1 pst add @pstdio/sdk`.

If extensions are new to you, read [Extensions](../concepts/0002-extensions.md) first.

## 1. Create the package

Create a folder for the extension, outside your project folder:

```sh
mkdir bookmarks
cd bookmarks
```

Add a `package.json`:

```json
{
  "name": "bookmarks",
  "version": "0.1.0",
  "displayName": "Bookmarks",
  "description": "Save links for a project.",
  "publisher": "acme",
  "main": "./extension.ts",
  "type": "module",
  "engines": {
    "pstdio": "^0.1.0"
  }
}
```

- `publisher` and `name` form the extension ID, here `acme.bookmarks`. Use your own publisher name. Each must start with a lowercase letter and contain only lowercase letters, numbers, and dashes.
- `main` is the entry file.
- `engines.pstdio` is the range of extension API versions the extension works with. `^0.1.0` accepts every compatible release of API 0.1. `pst extensions check` prints the API version of your Prompt Studio.

Then add the SDK, which has the functions and types for writing extensions:

```sh
bun add @pstdio/sdk
```

## 2. Add a command

Create `extension.ts`:

```ts
import { defineCommand, defineExtension, eventRef, params } from "@pstdio/sdk/extensions";

type Bookmark = { id: string; title: string; url: string };

const bookmarksChanged = eventRef<{ id: string }>({ extensionId: "acme.bookmarks", id: "changed" });

const bookmarkParams = {
  title: params.text({ label: "Title", required: true }),
  url: params.text({ label: "URL", required: true }),
};

const addBookmark = defineCommand({
  id: "add",
  title: "Add bookmark",
  cli: true,
  palette: [{ label: "Add bookmark" }],
  params: bookmarkParams,
  async run(ctx, { title, url }) {
    const bookmark: Bookmark = { id: crypto.randomUUID(), title, url };
    await ctx.storage.collection<Bookmark>("bookmarks").put(bookmark.id, bookmark);
    await ctx.events.emit(bookmarksChanged, { id: bookmark.id });
    return bookmark;
  },
});

export default defineExtension({
  commands: [addBookmark],
});
```

- `defineCommand` declares the command. Its ID `add` is local to the extension.
- `cli: true` adds it to the command line as `pst bookmarks add`. `palette` adds it to the dashboard's command palette.
- `params` declares typed parameters. The dashboard builds a form from them, and the CLI turns them into `--title` and `--url`.
- `ctx.storage` is storage that Prompt Studio keeps for this extension in the current project.
- After saving, the command emits the `bookmarksChanged` event so views can refresh. The event's `extensionId` must match `<publisher>.<name>`.
- `defineExtension` lists everything the extension adds. It is the file's default export.

## 3. Add a view

A view shows content in the dashboard. Prompt Studio has native views for tables, boards, trees, forms, and files, and webviews for custom pages. A native table fits this tool.

Replace `extension.ts` with the full version:

```ts
import {
  defineCommand,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineView,
  eventRef,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";

type Bookmark = { id: string; title: string; url: string };

const bookmarksChanged = eventRef<{ id: string }>({ extensionId: "acme.bookmarks", id: "changed" });

const bookmarkParams = {
  title: params.text({ label: "Title", required: true }),
  url: params.text({ label: "URL", required: true }),
};

const addBookmark = defineCommand({
  id: "add",
  title: "Add bookmark",
  cli: true,
  palette: [{ label: "Add bookmark" }],
  params: bookmarkParams,
  async run(ctx, { title, url }) {
    const bookmark: Bookmark = { id: crypto.randomUUID(), title, url };
    await ctx.storage.collection<Bookmark>("bookmarks").put(bookmark.id, bookmark);
    await ctx.events.emit(bookmarksChanged, { id: bookmark.id });
    return bookmark;
  },
});

const bookmarkTable = defineView({
  id: "bookmark-table",
  title: "Bookmarks",
  body: {
    kind: "dataTable",
    refreshEvents: [bookmarksChanged],
    columns: [
      { id: "title", label: "Title" },
      { id: "url", label: "URL" },
    ],
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
    async query(ctx) {
      const bookmarks = await ctx.storage.collection<Bookmark>("bookmarks").list();
      return {
        rows: bookmarks.map(({ id, title, url }) => ({ id, values: { title, url } })),
      };
    },
  },
});

const bookmarksPage = definePage({
  id: "bookmarks",
  title: "Bookmarks",
  path: "bookmarks",
  icon: "bookmark",
  mode: workbenchModes.project,
  main: { kind: "view", view: bookmarkTable.ref, cardinality: "one" },
  slots: [],
});

const bookmarksNavigation = defineNavigationItem({
  id: "bookmarks",
  label: "Bookmarks",
  icon: "bookmark",
  owner: workbenchModes.project,
  action: { kind: "page", page: bookmarksPage.ref },
});

export default defineExtension({
  commands: [addBookmark],
  views: [bookmarkTable],
  pages: [bookmarksPage],
  navigationItems: [bookmarksNavigation],
});
```

- The view's `query` reads the saved bookmarks and returns one row for each.
- `refreshEvents` runs `query` again after `bookmarksChanged`, so new bookmarks appear without a reload.
- The toolbar action runs the same `add` command. Its `input` opens a form for the title and URL.
- The page gives the view its own address in the project, and shows it as the page's main content.
- The navigation item adds a **Bookmarks** row to the project sidebar that opens the page.

## 4. Install it

Go to your project folder and install the extension from its folder:

```sh
cd ~/my-project
pst extensions add ../bookmarks
```

The path must start with `./`, `../`, or `~/`, or be absolute. A plain name such as `bookmarks` installs a published extension instead.

Prompt Studio copies the folder, installs its dependencies, checks it, and turns it on for the project. The output shows the extension ID and `Project: enabled for <project-id>`.

Try the command:

```sh
pst bookmarks add --title "Prompt Studio" --url https://prompt.studio
```

Open the dashboard and choose **Bookmarks** in the sidebar. The table shows the bookmark. Choose **Add bookmark** to save another one from the form.

To install a changed version, run the same command with `--force`. While you work on an extension, run the watcher instead:

```sh
pst extensions dev ../bookmarks
```

It checks and reloads the extension each time you save a file. Keep it running while you edit, and stop it with Ctrl+C.

## 5. Check it

Check the installed declarations:

```sh
pst extensions check
```

The check reports missing references, invalid IDs, unknown icons, and features your Prompt Studio version does not support. Each problem names the extension, the contribution, and the field.

Then run the smoke test. It installs the extension into a temporary Prompt Studio, opens its pages in a real browser, and reports errors. Install the browser once, then run the test:

```sh
pst extensions install-browser
pst extensions test ../bookmarks
```

Exit code 0 means the pages loaded without errors. [Smoke checks](0006-smoke-checks.md) explains what the test covers and what it skips.

## Next steps

- Let an agent build the next tool. Prompt Studio Skills, installed in every new project, includes a skill for writing extensions. Run `pst agents setup <agent-id>`, then ask your agent for the tool you want.
- Add pages with inspectors, editors, and custom modes with the [Workbench cookbook](0002-workbench-cookbook.md).
- Check or react to commands and events with the [Automation cookbook](0003-automation.md).
- Build a custom page with a webview. See [Webviews and storage](../../references/extensions/0005-webview-and-storage-api.md).
- Look up every contribution in the [extension API reference](../../references/extensions/0001-api.md), the [manifest rules](../../references/extensions/0002-manifest-and-installation.md), and [Workbench composition](../../references/extensions/0008-contextual-workbench-composition.md).
- Study complete tools in [Extension Lab](../../../extensions/extension-lab/README.md).
