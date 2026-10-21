# Extension Lab

Extension Lab has five small, working tools built only with the public extension API. Try them, then copy their code when you build your own.

| Example  | Resources     | Features                                                                |
| -------- | ------------- | ----------------------------------------------------------------------- |
| Scribble | Documents     | Editable Markdown, page search, favorites, new pages, saved edits       |
| Boombox  | Tracks        | Playlist, player controls, likes, queue                                 |
| Zipline  | Issues        | Kanban board, status changes, issue inspector                           |
| Pigeon   | Mail threads  | Search, folders, stars, archive, compose, sent mail                     |
| Kiln     | Scene objects | Three.js viewport, selection, visibility, transforms, animated timeline |

Each example adds its own page, mode, resource kind, views, sample data, and theme. A mode is a workbench layout with its own navigation, panels, and theme. A resource kind is a type of item, such as a document or a track, that the workbench can open and link to.

## Install

Extension Lab is not in the built-in extension catalog. Install it from a copy of the Prompt Studio repository. Use the release tag that matches `pst --version`, then run the install from inside a linked project folder:

```sh
git clone --depth 1 --branch pstdio@<version> https://github.com/pufflyai/prompt-studio.git
pst extensions add <path-to>/prompt-studio/extensions/extension-lab
pst extensions check
```

Open an example from the project's **Examples** group. You do not need a setup command or an external account. Boombox and Pigeon use local sample data. They do not play audio or send email.

## State and resources

The samples are ready right away. Your changes are saved in the extension's storage for the project. Each example keeps its field patches in one shared record. A grouped save applies every patch together, so edits to separate fields merge and a failed batch cannot delete earlier saved values. Existing patch collections migrate once. Parent replacements apply before child patches; a parent value hides concurrent child patches whose paths no longer apply. Views of the same example share one local editing session. Edits reach every view before the backend save finishes, and rapid edits share a coalesced save queue. Saved-change events refresh backend or agent edits. Navigation uses public page targets and resource references. No view reads the host's database or internal registries.

The helper in [example-store.ts](src/example-store.ts) uses the public `client.editing.open` API. `setState` publishes a durable edit. `preview`, `commitPreview`, and `cancelPreview` let a gesture update every view and save only on completion. `setTransient` keeps view-only playback progress local, including when a shared snapshot arrives. A structural change cancels drafts whose paths no longer apply. Views close their sessions when disposed.

This pattern requires the SDK and host support after 0.44.0 (extension API 0.2.1). Publish that support before installing this adoption revision.

Read an example's data from a terminal:

```sh
pst extension-lab resources list --name scribble
pst extension-lab state read --name kiln
```

## Mode defaults

`defineMode({ defaultTheme: theme.ref })` gives a mode its theme. The theme applies while the user has not picked another theme for that mode. A user's pick applies only to that mode. Leaving the mode brings back the global theme.

`chrome` places views in the mode's nav, sidenav, activity bar, or status bar. Set a region to `false` to hide it. Leave a region out to keep the host's default. Put sizes and collapsing in `regionSettings`. Set `showHeader: false` on a docked panel when the example draws its own controls, as Boombox does for its player.

Start with [the example definitions](src/examples), [view mounting](src/create-view.tsx), and [state commands](src/state-commands.ts). See [Modes and layout](../../documentation/references/extensions/0009-modes-and-layout.md) for the host API.

## Contributing

Inside the Prompt Studio repository, watch the extension while you change it:

```sh
pst extensions dev ./extensions/extension-lab
```

The dev command copies the extension and installs its own dependencies. To check the dashboard, run the repository's isolated Docker stack with `bun run dev:isolated` from a repository checkout.

The examples' layouts, data, and themes come from the workbench Showcase stories. Host contract fixtures, including the fake agent and the webview that fails on purpose, live in `packages/workbench-fixture`.
