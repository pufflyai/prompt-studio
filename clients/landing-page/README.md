# Landing page

The landing page uses the shared UI theme and panel separators. Its styles use
dedicated landing recipes and do not change the dashboard's components or theme.

## Code structure

- `src/components/workbench` owns page chrome and panel composition.
- `src/components/sections` contains Start Here, Why Prompt Studio, Features, and legal views.
- `src/components/downloads` contains the download picker and agent compatibility cards.
- `src/components/examples` contains the interactive icon set editor and coding agent demos.
- `src/content` owns navigation metadata, example data, building blocks, and legal copy.
- `src/hooks` connects browser navigation, release loading, and animation to React.
- `src/services` loads GitHub releases, selects desktop assets, and converts legal copy to Markdown.
- `src/services/shapes` owns tool geometry, placement, collisions, dragging, and simulation cleanup.

The demos and falling tools render in code. They use no screenshot or image assets.

## Layout

Every page keeps the 480px introduction and download panel on the left. Navigation
changes the right panel, preserving the selected download and resized panel width.
On small screens the panels stack and share one ScrollArea. Desktop panels scroll
independently. The home page shows a tools panel. Six tools start on the
floor at random positions and angles. One tool drops from a random position every
three seconds until there are 30. Tools can be dragged. Reduced motion keeps the
initial six tools still. Random placements stay stable through redraws and resizing.

The cross uses three collision rectangles that share the SVG arm dimensions. The
half-disc uses a curved polygon and renders around its physical centre of mass, so
its drawing and collisions stay aligned as it turns.

## Product examples

Why Prompt Studio tells a short product story through interactive examples. Visitors
can browse an icon set, follow work in a coding agent dashboard, and add previews to that
dashboard. These use local demo data. They do not call an agent or install extensions.

Features pairs the icon set editor and coding agent dashboard with their building blocks.
The icon set editor uses the existing Prompt Studio icons. Visitors can search by
name or codepoint, select an icon, and rename it in local demo state. Its grid and
inspector follow the repository's icon editor.
The dashboard supports agent selection, pause and resume, and approving a result.
Each building block keeps the same shape across the page and the falling tools.
Selecting a block opens an example that uses it. Search, notifications, navigation,
extension management, and themes appear in a separate section for shared services.
Use "workbench" for the overall home for tools. A workspace is a separate product concept.

The page layout and preview styles use the shared `landingStory` and `landingToolDemo`
recipes. Storybook covers desktop and narrow-panel layouts. Preview panels respond
to their actual container width, including when the download panel is resized.

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
