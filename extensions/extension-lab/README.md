# Extension Lab

Extension Lab has six small, working tools built only with the public extension API. Try them, then copy their code when you build your own.

| Example  | Resources     | Features                                                                |
| -------- | ------------- | ----------------------------------------------------------------------- |
| Scribble | Documents     | Editable Markdown, page search, favorites, new pages, saved edits       |
| Boombox  | Tracks        | Playlist, player controls, likes, queue                                 |
| Zipline  | Issues        | Kanban board, status changes, issue inspector                           |
| Pigeon   | Mail threads  | Search, folders, stars, archive, compose, sent mail                     |
| Kiln     | Scene objects | Three.js viewport, selection, visibility, transforms, animated timeline |
| Marmalade | Layered documents | Drawing, editable type, transforms, image adjustments, groups, undo/redo, and layer controls |

Each example adds its own page, mode, resource kind, views, sample data, and theme. A mode is a workbench layout with its own navigation, panels, and theme. A resource kind names an item type, such as a document or a track. Scribble and Zipline show how to open and link to those items through resource pages.

## Install

Extension Lab is not in the built-in extension catalog. Install it from a copy of the Prompt Studio repository. Use the release tag that matches `pst --version`, then run the install from inside a linked project folder:

```sh
git clone --depth 1 --branch pstdio@<version> https://github.com/pufflyai/prompt-studio.git
pst extensions add <path-to>/prompt-studio/extensions/extension-lab
pst extensions check
```

Open an example from the project's **Examples** group. You do not need a setup command or an external account. Boombox and Pigeon use local sample data. They do not play audio or send email.

## State and resources

The samples are ready right away. Your changes are saved in the extension's storage for the project. Views use the public editing-session API to share edits immediately across panels, while its save command persists changed fields. Storage events refresh that shared session after external changes. Kiln derives its playback frame from one saved start frame and time, so newly opened views stay in sync. Marmalade retains serialized document edits and saves history with each change.

Boombox, Pigeon and Kiln each have one tabless page. Their selected track, message or object lives in the page's declared `selection` parameter. Views subscribe with `client.page.subscribe` and change selection with `client.page.updateParams`. Selecting an item updates the existing views without opening a resource route, adding history entries or changing panel tabs. Scribble and Zipline demonstrate resource navigation instead. No view reads the host's database or internal registries.

Scribble uses a native searchable navigation tree. Search matches page titles and saved content. Drag pages or use Alt+Up/Down to reorder them; the extension persists that order. Native groups support renaming, icons, and drag-and-drop membership. Existing pages open retained tabs. **New page** opens an unpinned draft editor without creating a note. **Save page** creates the note; later content edits save automatically. Use **Pin tab** to retain a tab. Draft text stays in the editing preview until Save and is discarded when its view is released or reloaded. Page titles and icons update the tree, tab, and breadcrumb. Project switching uses the shared Workbench header.

Read an example's data from a terminal:

```sh
pst extension-lab resources list --name scribble
pst extension-lab state read --name kiln
```

## Marmalade

Open **Examples → Marmalade** to edit the Great Wave sample. Its canvas, tools, properties, and layer panel use Prompt Studio's public extension API. See [Marmalade](docs/0001-marmalade.md) for the controls, commands, state ownership, and sample-image attribution.

## Mode defaults

`defineMode({ defaultTheme: theme.ref })` gives a mode its theme. The theme applies while the user has not picked another theme for that mode. A user's pick applies only to that mode. Leaving the mode brings back the global theme.

`chrome` replaces mode navigation, sidenav, or activity content. Status views contribute `statusBarItems` with a mode condition, keeping host status items visible. Set a region to `false` to hide it. Leave a region out to keep the host's default. Declare only the panels a mode uses in `regions`. Scribble and Pigeon use Main and Side. Boombox’s Queue uses Side and its player uses Bottom; both panels set `canClose: false`. Put sizing, tab acceptance, floating, and close permissions in `regionSettings`. Set `showHeader: false` on a docked panel when the example draws its own controls, as Boombox does for its player.

Start with [the example definitions](src/examples), [view mounting](src/create-view.tsx), and [state commands](src/state-commands.ts). See [Modes and layout](../../documentation/references/extensions/0009-modes-and-layout.md) for the host API.

## Contributing

Inside the Prompt Studio repository, watch the extension while you change it:

```sh
pst extensions dev ./extensions/extension-lab
```

The dev command copies the extension and installs its own dependencies. To check the dashboard, run the repository's isolated Docker stack with `bun run dev:isolated` from a repository checkout.

The examples' layouts, data, and themes come from the workbench Showcase stories. Host contract fixtures, including the fake agent and the webview that fails on purpose, live in `packages/workbench-fixture`.
