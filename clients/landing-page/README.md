# Landing page

The landing page uses the shared UI theme and panel separators. Its Pencil source is
`design/prompt-studio-design-system.pen`; the main frame is `web/Landing Workbench`.

The home page has a 480px introduction panel and a tools panel. On small screens the
panels stack vertically. Sections use the shared ScrollArea. Six tools start on the
floor at random positions and angles. One tool drops from a random position every
three seconds until there are 30. Tools can be dragged. Reduced motion keeps the
initial six tools still. Random placements stay stable through redraws and resizing.

## Desktop downloads

`desktop-releases.ts` reads the public GitHub releases API. It selects a stable
`pstdio@` release with desktop assets and uses the asset URLs returned by GitHub.
The picker lists only published desktop packages, excluding CLI binaries and
extension releases. It prefers the visitor's operating system when available.
The selected build shows its platform, architecture, package format and version.
Each platform option occupies one row. A separate link opens the CLI documentation.
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
