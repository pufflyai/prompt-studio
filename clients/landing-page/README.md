# Landing page

The landing page uses reusable components and design tokens from `@pstdio/ui`.
Landing-specific recipes and stories live in this app, under `src/theme/recipes`.
They are passed directly to Chakra and are not registered in the shared UI theme.
The local theme extends the shared theme with the landing illustration colors.

## Code structure

- `src/components/workbench` owns page chrome and panel composition.
- `src/components/sections` contains Start Here, What is Prompt Studio, Examples, and Features.
- `src/components/downloads` contains the download picker and agent compatibility cards.
- `src/components/examples` contains the interactive icon set editor and coding agent demos.
- `src/content` owns the page catalog, navigation metadata, example data, building blocks, and which views are documents.
- `src/hooks` connects browser navigation, release loading, and animation to React.
- `src/services` resolves routes, page metadata, and structured data, loads GitHub releases, and selects desktop assets.
- `src/services/shapes` owns tool geometry, placement, collisions, dragging, and simulation cleanup.
- `src/theme/recipes` owns page layouts and demo styles, with colocated Storybook stories.
- `src/content/legal` holds the legal documents as markdown. See [Legal documents](#legal-documents).

The demos and falling tools render in code. They use no screenshot or image assets.

## Layout

Desktop pages keep the 480px introduction and download panel on the left. Navigation
changes the right panel, preserving the selected download and resized panel width.
On small screens the content comes first and the introduction and download panel
comes last. The panels share one ScrollArea, which returns to the top when the page
changes. CSS sets this order before hydration. Desktop panels scroll independently.
The home page shows a tools panel. Six tools start on the
floor at random positions and angles. One tool drops from a random position every
three seconds until there are 30. Tools can be dragged. The scene keeps its pieces,
positions, rotations, velocities, and spawn countdown in memory when navigating
within the site. Returning restores that scene. Refreshing starts a fresh scene
with six tools. Physics and spawning pause while
the page is unfocused, hidden, or the tools panel is outside the viewport. Returning
resumes the countdown without catching up for time away. Reduced motion keeps the
current pieces still. Resizing keeps pieces within the panel.

Embedded previews use visibility instead of keyboard focus so a preview toolbar
does not prevent the scene from starting after refresh. Normal browser tabs also
require focus.

The cross uses three collision rectangles that share the SVG arm dimensions. The
half-disc uses a curved polygon and renders around its physical centre of mass, so
its drawing and collisions stay aligned as it turns.

The desktop header contains the Prompt Studio tab and window controls. The green
control collapses or expands the window. Red and yellow enter window mode and are
disabled there. Drag the title bar to move the window. Mobile navigation opens a
menu below the header; desktop navigation uses the sidebar. There are no breadcrumbs.

Legal pages keep the workbench shell, with the title bar, sidebar, and status bar,
but show the document as one centered column without the introduction and download
panel. `DOCUMENT_VIEWS` in `src/content/landing-content.ts` names them.

Page navigation buttons sit in a header above the introduction and download panel,
outside that panel's scroll area. The right content panel keeps its full height. Legal documents have no previous or next page links.
Each button shows its destination page name and an arrow. Start Here
only shows the next page. The main pages follow the sidebar order, and Features
leads back to Start Here.
These links use browser history without remounting the download panel.

## Product examples

What is Prompt Studio lives at `/what-is-prompt-studio`. It starts with the building-block cards, then shows a clean editor,
connected tools, and tools adapted by an agent. Each entry has a title and subtitle,
with extra space between entries. The Tweak demo focuses on the shader and its controls.
The matrix speed control ranges from 0× to 4×.
Visitors can browse an icon set, follow work in a coding agent dashboard, and add previews to that
dashboard. These use local demo data. They do not call an agent or install extensions.

Examples pairs each tool with a short description and its building blocks.
Each tab is a link to a prerendered page:

- `/examples/coding-agent-dashboard/`
- `/examples/icon-set-editor/`
- `/examples/shader-editor/`
- `/examples/financial-formulas/`

The selected example comes from the URL. Reloading, opening a link in another tab,
and browser history preserve that selection. `/examples/` shows the first example
and declares its full URL as canonical.

The icon set editor uses the existing Prompt Studio icons. Visitors can search by
name or codepoint, select an icon, and rename it in local demo state. Its grid and
inspector follow the repository's icon editor.
The dashboard supports agent selection, pause and resume, and approving a result.
Each building block keeps the same shape across the page and the falling tools.
The shapes above each example explain the blocks it uses. Search, notifications, navigation,
extension management, and themes have a separate Features page. A single page gap separates feature sections, without extra section padding.
Use "workbench" for the overall home for tools. A workspace is a separate product concept.

The page layout and preview styles use the local `landingStory` and `landingToolDemo`
recipes. The app's Storybook covers desktop and narrow-panel layouts. Preview panels respond
to their actual container width, including when the download panel is resized.

Build these stories with `bun run --cwd clients/landing-page build-storybook`.
The reusable component stories remain in the UI package's Storybook.

The page catalog supplies static routes, unique metadata, canonical links, and
`/sitemap.xml`. `/robots.txt` points crawlers to that sitemap. Canonical URLs end
in a slash, matching the directory URLs the static server returns. `/404.html`
carries `noindex` and no canonical link.

`landing-structured-data.ts` builds one JSON-LD graph per page: an `Organization`
publisher, the `WebSite`, and the current `WebPage`. Only the start page adds a
`SoftwareApplication` node, so no other page claims to be a downloadable app.

## Legal documents

The privacy policy and the terms of service are markdown files in
`src/content/legal`, one per page: `privacy.md` is served at `/privacy/` and
`terms.md` at `/terms/`. The markdown is the only source of the legal text. Edit it
there, never in code.

Write one sentence per line. Markdown still renders consecutive lines as one
paragraph, but each change then shows up as its own line in a diff, so a reviewer
sees exactly which sentence changed between versions. A list item that needs more
than one sentence continues on an indented line.

Astro compiles the markdown at build time in `src/services/legal-documents.ts`. The
pages hand the HTML to the workbench as props, and `DocColumn` shows it, so the
served HTML holds every heading, paragraph, list, and link, and no markdown parser
ships to the browser. The `landingDoc` recipe styles the plain tags.

The build itself fails when a legal page in `DOCUMENT_VIEWS` has no markdown file, so
a renamed or deleted document cannot ship as an empty page.

## Brand assets

The social banner is the original 1546x423 image in `public/images/banner.png`.
The 180x180 Apple touch icon uses the full mark from the desktop
`clients/desktop/assets/icon.svg`, on an opaque white background.
The operating system supplies the home screen icon's rounded corners.

## Desktop downloads

`services/desktop-releases.ts` reads the public GitHub releases API.
`services/release-assets.ts` selects a stable `pstdio@` release with desktop assets
and uses the asset URLs returned by GitHub. `useDesktopDownloads` owns loading,
selection, and cancellation when the picker unmounts.
The picker lists only published desktop packages, excluding CLI binaries and
extension releases. It prefers the visitor's operating system when available.
The selected build shows its platform, architecture, package format and version.
Each platform option occupies one row. Other platforms and Use via CLI share a row
under the build details. The CLI link opens the repository's README on GitHub.
If GitHub cannot be reached, the download button opens the releases page.

## Isolated preview

Build the landing Docker image from the repository root:

```sh
docker build -f clients/landing-page/Dockerfile -t pstdio-landing-preview .
```

Run the image on a free localhost port. Mount `clients/landing-page/public/images`
at `/usr/share/nginx/html/images` as read-only; public images are excluded from
the shared Docker build context. Keep this preview separate from the dashboard
and its database.
