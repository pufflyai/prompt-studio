# Landing page

The landing page uses reusable components and design tokens from `@pstdio/ui`.
Landing-specific recipes and stories live in this app, under `src/theme/recipes`.
They are passed directly to Chakra and are not registered in the shared UI theme.
The local theme extends the shared theme with the landing illustration colors.

## Code structure

- `src/components/workbench` owns page chrome, panel composition, and the reading column.
- `src/components/sections` contains Start Here, What is Prompt Studio, Examples, and Features.
- `src/components/docs` and `src/components/blog` contain the Docs and Blog sidebars and pages.
- `src/components/downloads` contains the download picker and agent compatibility cards.
- `src/components/examples` contains the interactive icon set editor and coding agent demos.
- `src/content` owns the static pages, navigation metadata, example data, building blocks, and the docs allow-list (`docs-topics.ts`).
- `src/hooks` connects browser navigation, release loading, and animation to React.
- `src/services` builds the page catalog, resolves routes, page metadata, and structured data, loads GitHub releases, and selects desktop assets.
- `src/services/markdown` holds the markdown plugins that rewrite links and read page descriptions.
- `src/services/shapes` owns tool geometry, placement, collisions, dragging, and simulation cleanup.
- `src/theme/recipes` owns page layouts and demo styles, with colocated Storybook stories.
- `src/content/legal` holds the legal documents as markdown. See [Legal documents](#legal-documents).
- `src/content/blog` holds the blog posts as markdown. See [Blog](#blog).

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

The desktop header contains the window controls and three tabs: Prompt Studio, Docs,
and Blog. The mobile header shows the same tabs. A shortcut indicator at the top right
opens the action menu: Command+P on Mac, or Ctrl+P elsewhere. The selected tab follows the URL.
Each tab has its own sidebar. Selecting another tab reopens the last page read in
that section during this visit; selecting the open tab returns to the section's first
page (`/`, `/docs/`, or `/blog/`). A reload starts fresh. The green control collapses
or expands the window. Red and yellow enter window mode and are disabled there. Drag
the title bar to move the window. On small screens the current page name below the
header opens the command palette; desktop navigation uses the sidebar. There are no
breadcrumbs.

Every same-site link, including links inside docs HTML, opens without a reload, so
the tool scene, window mode, and sidebar width survive moving between tabs.

Legal pages, docs, and posts keep the workbench shell, with the title bar, sidebar,
and status bar, but show one centered reading column without the introduction and
download panel.

Page navigation buttons sit in a header above the introduction and download panel,
outside that panel's scroll area. The right content panel keeps its full height. Legal documents and posts have no previous or next page links.
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

`/docs/` lists the same tree as the sidebar. Docs pages show previous and next links
in sidebar order and, on wide screens, an outline of their `##` headings that marks
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
The newest list entry has a wider banner and larger title. Older entries omit artwork
in the list. Every card opens its article across its whole area. Article banners use
the site's light or dark theme; share metadata uses light artwork.

## Analytics

The existing PostHog client records custom events for action-menu opens and window
button clicks. See the [website analytics reference](../../documentation/references/website/0001-analytics.md)
for event names, properties, counting rules, and local validation.

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

```sh
docker run -d --name pstdio-landing-preview -p 127.0.0.1::80 \
  -v "$PWD/clients/landing-page/public/images:/usr/share/nginx/html/images:ro" \
  pstdio-landing-preview
docker port pstdio-landing-preview 80
```

Open the printed address with `http://`. Rebuild the image and recreate the
container to see content changes. Stop and remove it with
`docker rm -f pstdio-landing-preview`.
