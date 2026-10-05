# Artifacts

Artifacts lets agents publish self-contained HTML pages, such as reports, charts, or small tools, and lets you browse every saved version in Prompt Studio.

You install Artifacts once for your user, and it works in every project. Each project has its own library. Each published version is kept and never changed.

## Install

Artifacts is an optional extension. Its public package is named `pstdio-artifacts`; installing it does not make published pages public. Open **Settings → Project → Extensions**, find **Artifacts** under **Available**, and select **Install**. You can also run:

```sh
pst extensions add pstdio-artifacts
```

## Publish a page

Agents publish pages with the `pst pstdio-artifacts` commands. Artifacts gives agents a `publish-artifact` skill that explains the steps, so you can simply ask an agent to publish a page.

```sh
pst pstdio-artifacts publish --file_path ./dist/index.html --favicon '📦' --label 'First draft' --json
pst pstdio-artifacts publish --file_path ./dist/index.html --url '<returned url>' --label 'Updated' --json
pst pstdio-artifacts list --json
pst pstdio-artifacts read --url '<returned url>' --json
pst pstdio-artifacts revisions --url '<returned url>' --json
pst pstdio-artifacts open --url '<returned url>' --json
pst pstdio-artifacts rename --url '<returned url>' --name 'New name' --json
pst pstdio-artifacts delete --url '<returned url>' --json
```

`publish` takes the HTML file in `--file_path`, an optional `--favicon` emoji, and an optional `--label` for the version. Leave out `--url` to create a new artifact. Pass the `url` that an earlier publish returned to add a new version to that artifact. The option names match Anthropic's artifact publishing tool.

The result also contains the artifact ID, the version ID, the title, and a link target for the dashboard. With `--json`, the result is under `outcome.value`. `list` accepts `--search`. `read` shows the latest version, or the one you name with `--revision-id`. `open` opens the artifact in the dashboard and returns its latest version.

The command reads the file from the agent's current workspace. Without one, it reads from the project's default folder.

## Browse artifacts

Open **Artifacts** in the project navigation. The library shows a grid of page previews with their names and edit dates. Select a card to open the artifact. Cards also work with the keyboard. Use the search field to filter the library.

The library stays open as an **Artifacts** tab next to each artifact you open. Switching tabs keeps your search and the state of each interactive preview. A link to a published URL opens the matching artifact tab.

Each artifact has one menu, named after the artifact. Use it to:

- Pick a version. New versions appear there without resetting the preview you are looking at.
- Rename the artifact. The new name applies to all versions and later updates. The saved HTML does not change.
- Delete the artifact. After you confirm, Artifacts removes all its versions and their saved copies. Your original source files stay.
- Go back to the library tab.

## Pages that follow the theme

Previews and thumbnails follow the dashboard's light or dark theme. When you switch themes, the page does not reload and keeps its state. The page body takes the dashboard's background, text color, and font. Use these CSS variables for the rest of the page:

| Variable             | Use it for                    |
| -------------------- | ----------------------------- |
| `--artifact-bg`      | Page background               |
| `--artifact-surface` | Cards and secondary surfaces  |
| `--artifact-fg`      | Main text                     |
| `--artifact-muted`   | Captions and secondary text   |
| `--artifact-border`  | Borders and chart grid lines  |
| `--artifact-accent`  | Links and chart highlights    |
| `--artifact-font`    | The dashboard's body font     |

The root element's `data-theme` attribute is `light` or `dark`, and `prefers-color-scheme` queries follow it. SVG and CSS that use the variables update by themselves. A page that draws on a canvas can watch the root element's `style` attribute and redraw. A page that sets its own fixed colors keeps them.

[Weekly activity](examples/weekly-activity.ts) is a complete example. It has a themed SVG chart, category filters, a week slider, and day selection that works with the keyboard. It uses made-up sample data.

## Limits

- Artifacts accepts `.html` and `.htm` files in UTF-8, up to 16 MiB. Put scripts, styles, and images inside the HTML file. Artifacts does not run a build step, a server, a Markdown renderer, or React source code.
- The title comes from the page's first `<title>`, or from the file name when there is none. The emoji and the version label are optional.
- A published page runs in a locked-down frame. Its scripts run, but it cannot reach Prompt Studio, read the dashboard, make network requests, submit forms, or open other pages. Links and redirects to other sites are blocked.
- Commands that update or read an artifact accept only the URL that `publish` returned, not a full browser address.
- When two agents publish to the same artifact at once, each publish becomes its own version. Versions are ordered by publish time.
- There is no sharing, public hosting, automatic clean-up, or loading of files from outside the page. A preview's state lasts while its tab stays open.
