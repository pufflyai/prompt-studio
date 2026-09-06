# Extension Lab

Five working examples of the public extension API. Their layouts, data, and themes come from the workbench Showcase stories.

| Example | Resources | Features |
| --- | --- | --- |
| Scribble | Documents | Editable Markdown, page search, favorites, new pages, saved edits |
| Boombox | Tracks | Playlist, player controls, likes, queue |
| Zipline | Issues | Native Kanban board, status changes, issue inspector |
| Pigeon | Mail threads | Search, folders, stars, archive, compose, sent mail |
| Kiln | Scene objects | Three.js viewport, selection, visibility, transforms, animated timeline |

Each example contributes its own page, mode, resource kind, views, sample resources, and theme. Select an example in the project's Examples group. No setup command or external account is required. Boombox and Pigeon use local sample data; their controls do not stream audio or send email.

Lab (faulty) remains as the intentional webview failure example. Host contract fixtures, including the fake agent, now live in `packages/workbench-fixture`.

## Install and develop

```sh
pst extensions add ./extensions/extension-lab
pst extensions check
pst extensions dev ./extensions/extension-lab
```

Follow the repository's Docker workflow for dashboard validation. The dev command copies the extension and installs its own dependencies.

## State and resources

Samples are available immediately. Changes are stored through project-scoped extension storage. Each changed field has its own collection entry, so edits in different views do not overwrite unrelated fields. Command completion events refresh the other webviews. Navigation uses public page targets and resource references; no view reads the host's database or internal registries.

```sh
pst extension-lab resources list --name scribble
pst extension-lab state read --name kiln
```

## Mode defaults

`defineMode({ defaultTheme: theme.ref })` assigns a theme. It is used when the mode has no saved user preference. A user's selection stays scoped to that mode. Leaving the mode restores the global theme.

`chrome` assigns views to the mode's nav, sidenav, activity bar, or status bar. Use `false` to hide a region. Omit a region to retain host chrome. Sizes and collapsibility belong in `regionSettings`. Set `showHeader: false` on a docked panel when the example supplies its own controls, as Boombox does for its player.

Start with [the example definitions](src/examples), [view mounting](src/create-view.tsx), and [state commands](src/state-commands.ts). See [mode contracts](../../.pstdio/docs/extensions/modes-and-layout.md) for the host API.
