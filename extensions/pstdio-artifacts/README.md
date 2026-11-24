# Artifacts

Artifacts lets agents publish self-contained HTML pages, such as reports, charts, or small tools, and lets you browse every saved version in Prompt Studio.

Keep draft HTML, prototype sources, and screenshots under `.pstdio/extension-storage/pstdio.artifacts/drafts/<name>/`. Published snapshots use this extension's storage too. See [extension file storage](../../documentation/guides/extensions/0008-extension-storage.md).

Install Artifacts once for your user, then turn it on in each project that should use it. Installing from a project turns it on there. Each project has its own library. Published versions are snapshots; publishing again adds a version instead of changing an old one.

## Install

Artifacts is an optional extension in the extension catalog. Its install name is `artifacts`; installing it does not make published pages public. Open **Settings → Project → Extensions**, find **Artifacts** under **Available**, and select **Install**. You can also run:

```sh
pst extensions add pstdio-artifacts
```

## Create a page

Open **Artifacts** and click the **Project brief** or **System diagram** button under **Make something new**. Each example starts and opens an agent session using your project’s configured agent. The agent uses the project’s available context and the `publish-artifact` skill to publish the result here. You can also ask any session to create and publish another kind of interactive page.

## Publish a page

Agents publish pages with the `pst pstdio.artifacts` commands. Artifacts gives agents a `publish-artifact` skill that explains the steps, so you can simply ask an agent to publish a page.

```sh
pst pstdio.artifacts publish --file_path ./dist/index.html --favicon '📦' --label 'First draft' --json
pst pstdio.artifacts publish --file_path ./dist/index.html --url '<returned url>' --label 'Updated' --json
pst pstdio.artifacts list --json
pst pstdio.artifacts read --url '<returned url>' --json
pst pstdio.artifacts revisions --url '<returned url>' --json
pst pstdio.artifacts open --url '<returned url>' --json
pst pstdio.artifacts rename --url '<returned url>' --name 'New name' --json
pst pstdio.artifacts delete --url '<returned url>' --json
```

`publish` takes the HTML file in `--file_path`, an optional `--favicon` emoji, and an optional `--label` for the version. Leave out `--url` to create a new artifact. Pass the `url` that an earlier publish returned to add a new version to that artifact. The option names match Anthropic's artifact publishing tool.

The result also contains the artifact ID, the version ID, the title, and a link target for the dashboard. With `--json`, the result is under `outcome.value`. `list` accepts `--search`. `read` shows the latest version, or the one you name with `--revision-id`. `open` opens the artifact in the dashboard and returns its latest version.

The command reads the file from the agent's current workspace. Without one, it reads from the project's default folder.

## Links in artifacts

Use fragment links such as `<a href="#details">Details</a>` to jump to a section with `id="details"`. These links work in the dashboard preview and in exported HTML.

The preview blocks navigation to other pages, including Prompt Studio pages and links that request a new tab. Show the full destination URL as selectable text with a descriptive label so readers can paste it into their browser. When sharing the artifact in a conversation, include important destinations as clickable links in your message too.

## Browse artifacts

Open **Artifacts** in the project navigation. The library shows a grid of page previews with their names and edit dates. Select a card to open the artifact. Cards also work with the keyboard.

Artifacts are also searchable resources. Search by their current name to open them from global search or choose them in a resource picker. Each artifact appears once and disappears from search when deleted.

When an agent mentions a saved snapshot path, such as `.pstdio/extension-storage/pstdio.artifacts/sites/<revision-id>.html`, in a conversation, the link shows the artifact's current name and opens its dashboard reader instead of the raw file. The reader restores your saved version selection across reloads and project returns; without a saved selection, it opens the latest version. Choose the latest entry in **Versions** to move a retained reader to the newest published version.

The library and each artifact open as pages, like Tickets. Opening another artifact changes the current page without adding tabs. Use the breadcrumb to return to the library, or browser Back and Forward to revisit a page. A published URL opens the matching artifact.

Choose a saved revision from the **Versions** dropdown on the right of the panel header. The menu has a maximum height and scrolls through the history. Each version shows its creation date and time. New versions appear without resetting the current preview, and your selected version is remembered when you reopen the reader. Use the action menu beside the breadcrumb to:

- Rename the artifact. The new name applies to all versions and later updates. The saved HTML does not change.
- Delete the artifact. After you confirm, Artifacts removes all its versions and their saved copies. Your original source files stay.

## Export an artifact

Choose **Export HTML** in the artifact actions dropdown beside the breadcrumb, alongside Rename and Delete, to download the displayed saved version.
The file includes its scripts, embedded images and the current preview theme, and
opens in a browser without Prompt Studio. It starts from the saved HTML; temporary
form values, filters and other preview state are not included. Your browser handles
the download location and cancellation.

Agents can save the latest version to a workspace-relative destination:

```sh
pst pstdio.artifacts export --url '<returned url>' --file_path exports/report.html
```

Add `--revision-id '<version id>'` to export an earlier version. Without
`--file_path`, the command returns the portable `html`, suggested `fileName` and
`revisionId`. CLI exports use system theme colors unless a theme is supplied.
Exports leave the published versions unchanged and work after the original source
file has been removed. External assets are not fetched or bundled.

## Pages that follow the theme

Previews and thumbnails follow the dashboard's light or dark theme. Scrollbars in previews and exported HTML use the shared scroll-area thickness and theme colors, including nested scrolling content. When you switch themes, the page does not reload and keeps its state. The page body takes the dashboard's background, text color, and font. Use these CSS variables for the rest of the page:

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

*Updated at: 2026-10-26*
