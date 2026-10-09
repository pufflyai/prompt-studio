# Landing page

The landing page uses reusable components and design tokens from `@pstdio/ui`.
Landing-specific recipes and stories live in this app, under `src/theme/recipes`.
They are passed directly to Chakra and are not registered in the shared UI theme.
The local theme extends the shared theme with the landing illustration colors.

## Code structure

- `src/components/workbench` owns page chrome, panel composition, and the reading column.
- `src/components/sections` contains Home, What is Prompt Studio, Examples, and Features.
- `src/components/docs` and `src/components/blog` contain the Docs and Blog sidebars and pages.
- `src/components/downloads` contains the download picker and agent compatibility cards.
- `src/components/examples` contains the interactive icon set editor and coding agent demos.
- `src/content` owns the static pages, navigation metadata, example data, building blocks, and the docs allow-list (`docs-topics.ts`).
- `src/hooks` connects browser navigation, release loading, and animation to React.
- `src/services` builds the page catalog, resolves routes, page metadata, and structured data, loads GitHub releases, and selects desktop assets.
- `src/services/markdown` holds the markdown plugins that rewrite links and read page descriptions.
- `src/services/shapes` owns tool geometry, pointer dragging, and agent assembly.
- `src/theme/recipes` owns page layouts and demo styles, with colocated Storybook stories.
- `src/content/legal` holds the legal documents as markdown. See [Legal documents](#legal-documents).
- `src/content/blog` holds the blog posts as markdown. See [Blog](#blog).

The demos and tool stencils render in code. They use no screenshot or image assets.

## Layout

Only the home page shows the introduction and download picker. They share one
continuous surface with the tool assembly scene, without a divider or resize handle.
The layout places one tool editor beside the copy when there is room and below it on
smaller screens. Other pages use the full content area beside the navigation.

The download column retains its original 480-pixel width and horizontal padding on desktop.
Compact vertical spacing and an editor sized from its container leave room for the pile without
scrolling in a 1080p browser window, including windowed mode.
The download button uses a download icon. The platform menu uses monochrome macOS,
Windows, or Linux logos for each build.
All 28 building-block shapes start in a settled pile beneath the editor. Matter.js supplies gravity,
collisions, rotation, momentum, and wall bounces across the entire main area,
including the download area. Only docked shapes remain fixed. Drag or toss blocks
with a mouse, touch, or pen; pulling one out of a slot makes it fall again.
The download links remain clickable above the scene.
The build description and platform controls reserve their space while downloads
load, so resolving a release does not shift the scene's ground on mobile.
The settled pile is included in the static HTML and appears before JavaScript loads.
Its ground-relative positions are shared with the physics engine, which starts the
shapes asleep instead of calculating their resting positions during startup. The
editor outline also appears in the static HTML at its fitted size. The live editor
and cursors appear once their layout is measured. Idle cursors drift slowly over
short distances while they wait for their next task. Initialization does not
wait for fonts, stretch the shapes, or play a falling startup animation.
Animation starts as soon as the visible scene is measured. Desktop release info
loads independently, and a pending or failed download request does not delay it.
The startup bundle contains the page chrome, downloads, settled shapes, physics,
cursor animation, and first icon demo. Shader, agent, and formula demos, secondary
pages, their navigation, the command menu, and analytics load after the first
paint, one module at a time during idle periods. Opening a page or menu can load
it immediately. Shared preload promises avoid duplicate requests. Static HTML
still includes each page's content. The website uses no rich-text editor; optional
markdown controls in the shared UI package import their lazy loader directly.
Shape positions, angles, velocity, sleeping state, docked slots, cursor jobs, and
the current assembly loop survive client navigation. Reloading starts a fresh scene.

One editor uses the same icon set, shader, agent dashboard, and financial formula
components as the example pages. Each matching shape reveals another part of that
example. Its title appears only after all required blocks are in place. Occupied
slots lose their dashed outlines. All slot outlines use the same stroke and dash sizes.
The editor slot outlines both edges of its hollow square. Every combination uses
the same board dimensions within a container, with spacing reserved for the five-slot combination.
The 640-pixel reference board grows on larger screens and shrinks on smaller ones.
Its scale follows both the available width and height, leaving room for the pile
and keeping shapes and the slot tray at their physical size. The board uses 85% of
the fitted size. Its controls stay at their reference scale as the board grows,
so larger screens show more content instead of oversized UI. The landing preview
hides its scrollbars while allowing the animated agents to reveal their controls.
The shader code pane fills its panel's remaining height.
The measured download column and the theme's font scaling keep that layout
aligned on large displays too.
Shapes keep their original size when inserted,
removed, or resized with the viewport. Larger slots keep room around each shape,
and their tray stays full height on mobile. Removing a shape removes its contribution.
Claude, Codex, and OpenCode use filled pointers without borders or tails and upright name
labels. They enter from beyond the right edge and follow curved paths with eased motion at a relaxed pace. They assemble an example,
use its controls, return the shapes to the pile, and build another
combination. Grabbing a cursor's shape hands it to the person; the cursor stays
visible and finds another task. Cursors leave recently handled shapes alone for
four seconds. Arrow keys move focused shapes; Enter docks them in nearby slots.
Selecting a shape does not add an outline on desktop or mobile.
Agents select and rename icons, type a shader change and adjust its controls,
select ticket sessions, and change formulas and inputs. These actions use the
same local demo handlers as the example pages. Cursors show a pointer while moving,
a closed hand while carrying a shape, and a text cursor while typing.
Each assembled tool also demonstrates a CLI command. The cursor becomes a chat
bubble in its own color and keeps moving while it types. The bubble stays on one
compact line, follows the typed text horizontally, and shows a check when complete.
Finishing the command updates the same local icon, shader, ticket, or formula state as the editor controls.
These previews remain entirely static-site demos, with no shell or backend calls.
Shader typing keeps the edited line in view without scrolling back and forth
between the edges of the code field. Comment delimiters are inserted together so
the preview keeps valid shader code throughout the edit.
The landing preview shows four representative icons in two columns with larger
glyphs on all screens. Search still finds icons from the full set. Other pages
retain the full twelve-icon editor, including on mobile.

The playground has no pause button or section labels. Physics pauses when the
scene is offscreen or the browser tab is hidden. Reduced motion starts with a
settled field and disables agent motion; dragging and docking still work.
The canvas, collision bounds, editor, and docked shapes follow container resizing.

The desktop header contains the window controls and three tabs: Prompt Studio, Docs,
and Blog. On mobile, one hamburger button at the top right opens all main sections,
Docs, and Blog in a full-screen navigation palette. It focuses the dialog on open;
search only takes focus when tapped, keeping the mobile keyboard closed. A desktop shortcut indicator at the top right
opens the action menu: Command+P on Mac, or Ctrl+P elsewhere. The selected tab follows the URL.
Each tab has its own sidebar. Selecting another tab reopens the last page read in
that section during this visit; selecting the open tab returns to the section's first
page (`/`, `/docs/`, or `/blog/`). A reload starts fresh. The green control collapses
or expands the window. Red and yellow enter window mode and are disabled there. Drag
the title bar to move the window. Desktop navigation uses the sidebar. The mobile
header has no separate page menu or site tabs. There are no breadcrumbs.

Every same-site link, including links inside docs HTML, opens without a reload, so
window mode and sidebar width survive moving between tabs.

Legal pages, docs, and posts keep the workbench shell, with the title bar, sidebar,
and status bar, but show one centered reading column without the introduction and
download panel.

On mobile, docs index links fill their row with a minimum 44-pixel touch target.
Inline reading links gain padding and height so they are easier to tap.

Pages have no previous or next buttons. The sidebar, title bar tabs, and command
palette provide navigation.

## Product examples

What is Prompt Studio lives at `/what-is-prompt-studio`. Its carousel shows one
chapter at a time: building blocks, a clean editor, connected tools, and tools
adapted by an agent. A compact chapter tab row stays visible above the content. Both carousels
advance every eight seconds and wrap to the first chapter. Pointer hover,
keyboard focus, or a hidden browser tab suspends playback. Selecting a tab
or swiping horizontally also changes the chapter. Chapters change immediately,
without transition animations. Arrow keys navigate focused tabs. Reduced motion disables autoplay.
Each chapter scrolls within the available panel height on desktop and mobile;
scrolling never advances to another chapter. There is no numbered stepper or pause
button. The Tweak demo focuses on the shader and its controls.
The matrix speed control ranges from 0× to 4×.
Visitors can browse an icon set, follow work in a coding agent dashboard, and add previews to that
dashboard. These use local demo data. They do not call an agent or install extensions.

Examples uses the same carousel and pairs each tool with a short description and its building blocks.
Editor panels keep their content height; shader panels share a height so the code
area fills the space beside its preview.
Shader canvases and formula plots have bounded heights on the example pages.
Each tab is a link to a prerendered page:

- `/examples/coding-agent-dashboard/`
- `/examples/icon-set-editor/`
- `/examples/shader-editor/`
- `/examples/financial-formulas/`

The selected example comes from the URL. Reloading, opening a link in another tab,
and browser history preserve that selection. Automatic changes replace the current
history entry; manual selections add an entry. `/examples/` shows the first example
and declares its full URL as canonical.

The icon set editor uses the existing Prompt Studio icons. Visitors can search by
name or codepoint, select an icon, and rename it in local demo state. Its grid and
inspector follow the repository's icon editor.
The dashboard supports agent selection, replaying the workflow, and approving a result.
Each building block keeps the same shape across the page and the tool stencils.
The shapes above each example explain the blocks it uses. Search, notifications, navigation,
extension management, and themes have a separate Features page. A single page gap separates feature sections, without extra section padding.
Use "workbench" for the overall home for tools. A workspace is a separate product concept.

The page layout and preview styles use the local `landingStory` and `landingToolDemo`
recipes. The app's Storybook covers desktop and narrow-panel layouts. Preview panels respond
to their actual container width.

Build these stories with `bun run --cwd clients/landing-page build-storybook`.
The reusable component stories remain in the UI package's Storybook.

The page catalog supplies static routes, unique metadata, canonical links, and
`/sitemap.xml`. `/robots.txt` points crawlers to that sitemap. Canonical URLs end
in a slash, matching the directory URLs the static server returns. `/404.html`
carries `noindex` and no canonical link.

`landing-structured-data.ts` builds one JSON-LD graph per page: an `Organization`
publisher, the `WebSite`, and the current `WebPage`. Only the start page adds a
`SoftwareApplication` node, so no other page claims to be a downloadable app.

## Document pipeline

Astro content collections in `src/content.config.ts` read every markdown document at
build time:

- `docs` reads the published files straight from the repo: `documentation/` and each
  extension's `README.md` and `docs/` folder. The website keeps no copy.
- `blog` reads `src/content/blog`.
- `legal` reads `src/content/legal`.

`src/services/site-catalog.ts` combines them with the static pages in
`src/content/landing-pages.ts` into one catalog. The catalog drives the routes in
`src/pages/[...path].astro`, the sidebars, the command palette, `/sitemap.xml`, page
metadata, and structured data. Docs pages carry `WebPage`, posts `BlogPosting` with
author and date, and `/blog/` carries `Blog`.

Each page gets its own document HTML and the catalog of titles and paths, not every
document. `src/pages/documents/[...path].json.ts` writes each document as JSON, and
`useLandingDocument` fetches it when the visitor moves to another page. Until it
arrives, the previous page stays in place, dimmed after a short delay, so the layout
does not shift.

The build always runs with `--force`, which clears Astro's content cache. Every build
renders every document again, so link checks never come from a stale cache.

## Docs

`DOCS_TOPICS` in `src/content/docs-topics.ts` is the ordered allow-list of published
folders. It sets each sidebar group's section, label, and URL. A folder that is not
on the list is never published, so ADRs, PRDs, lessons learned, development guides,
and architecture notes stay in the repo. Everything else comes from the files:

- Page order is the four-digit file number.
- The page title is the file's first `#` heading. The build fails without it.
- The meta description is the first paragraph after that heading, as plain text. The
  build fails without it.
- The URL is the file name without its number:
  `documentation/references/cli/0006-sessions.md` becomes `/docs/references/cli/sessions/`.
- An extension's `README.md` is its overview page at `/docs/extensions/<slug>/`.

`/docs/` lists the same tree as the sidebar. Docs pages show, on wide screens,
an outline of their `##` headings that marks
the one in view. The `landingDoc` recipe styles the markdown tags, including tables
and code. Shiki's `css-variables` theme colors code, and the recipe maps those
variables to design tokens, so code follows the color mode.

### Link rules

The same markdown works on GitHub and on the site. At build time the
`published-links` plugin in `src/services/markdown` rewrites relative links:

- A link to a published page becomes its site path, with any `#heading` kept.
- A link to any other repo file or folder becomes a GitHub link on `main`.
- A link to a missing file fails the build. The error names the page and the link.

## Blog

Posts are markdown files in `src/content/blog/<slug>.md`, served at `/blog/<slug>/`.
The collection schema checks the frontmatter, and a missing or malformed field fails
the build:

```md
---
title: Welcome to Prompt Studio
description: One sentence for the post list and search results.
published: 2026-04-24
author: aurelien-franky
category: thoughts
image:
  light: ../../../../../design/art/blog-welcome-to-prompt-studio-light.png
  dark: ../../../../../design/art/blog-welcome-to-prompt-studio.png
---
```

Write `published` without quotes so YAML reads it as a date. `/blog/` and the Blog
sidebar list posts newest first.
Use a UTC timestamp to order posts published on the same day. Preserve the original
publication date when updating or restoring a post; check its frontmatter in Git.
Every post has one required category: `release`, `thoughts`, or `tool showcase`.
Release posts cover shipped versions; thoughts cover ideas and personal essays;
tool showcases explain a specific tool and how people and agents use it.
The category appears in article and list metadata and in `BlogPosting.articleSection`.
`PostView` prefixes each release article’s body with the shared alpha notice. Update
that notice when Prompt Studio reaches beta. It explains that the APIs and core
feature set are still being defined and daily changes may break existing tools.
The newest list entry has a wider banner and larger title. Older entries omit artwork
in the list. Every card opens its article across its whole area. Article banners use
the site's light or dark theme; share metadata uses light artwork.

Record future UX GIFs in matching light and dark variants. Follow the
[documentation media rules](../../documentation/guides/0001-documentation.md#screenshots-and-gifs)
for sample data, naming, theme selection, and playback checks.

## Analytics

The existing PostHog client records custom events for action-menu opens and window
button clicks. See the [website analytics reference](../../documentation/references/website/0001-analytics.md)
for event names, properties, counting rules, and local validation.
The analytics library loads in the background after the page paints. An early
interaction queues its event until the library is ready.

## Legal documents

The privacy policy and the terms of service are markdown files in
`src/content/legal`, one per page: `privacy.md` is served at `/privacy/` and
`terms.md` at `/terms/`. The markdown is the only source of the legal text. Edit it
there, never in code.

Write one sentence per line. Markdown still renders consecutive lines as one
paragraph, but each change then shows up as its own line in a diff, so a reviewer
sees exactly which sentence changed between versions. A list item that needs more
than one sentence continues on an indented line.

Astro compiles the markdown at build time through the `legal` collection. Each page
hands its HTML to the workbench, and `DocColumn` shows it, so the served HTML holds
every heading, paragraph, list, and link, and no markdown parser ships to the
browser. The `landingDoc` recipe styles the plain tags.

The build fails when a legal page in `src/content/landing-pages.ts` has no markdown
file, so a renamed or deleted document cannot ship as an empty page.

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
under the build details. The CLI link opens the install guide in the Docs tab.
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
The static preview compresses HTML, JavaScript, CSS, and JSON responses and caches
hashed assets. It does not require an application backend.

```sh
docker run -d --name pstdio-landing-preview -p 127.0.0.1::80 \
  -v "$PWD/clients/landing-page/public/images:/usr/share/nginx/html/images:ro" \
  pstdio-landing-preview
docker port pstdio-landing-preview 80
```

Open the printed address with `http://`. Rebuild the image and recreate the
container to see content changes. Stop and remove it with
`docker rm -f pstdio-landing-preview`.
