---
name: publish-artifact
description: Publish a self-contained interactive HTML page into the Prompt Studio dashboard, or update an existing artifact.
---

Create one `.html` or `.htm` file inside the active workspace. Set its `<title>`. Inline CSS and JavaScript and embed images/fonts as data URLs. Pages have no backend or host API access. Keep the HTML under 16 MiB.

Use the supplied CSS variables so the page follows the dashboard theme: `--artifact-bg`, `--artifact-surface`, `--artifact-fg`, `--artifact-muted`, `--artifact-border`, `--artifact-accent`, and `--artifact-font`. The body gets the background, foreground, and font by default. Use the surface, muted, border, and accent variables for cards, captions, borders, and chart marks. Avoid fixed page colors. Variables and the root `data-theme="light"` or `"dark"` update live without resetting the page. CSS `prefers-color-scheme` and `light-dark()` also follow the dashboard. For canvas charts, redraw on theme changes by observing the root's `style` attribute; SVG and CSS charts update automatically when they use these variables.

Publish with `pst pstdio-artifacts publish --file_path path/to/page.html --favicon "📦" --label "First draft"`.

The result includes `url`, `artifactId`, `revisionId`, and a dashboard navigation target. Give the user the internal dashboard URL. It is project-local navigation, not public hosting or sharing.

To update, edit the file and run the same command with `--url "<returned-url>"`. Always retain and pass the URL for updates. Omitting it creates a new artifact. Each publish preserves earlier revisions.

Use `pst pstdio-artifacts list`, `read --url "<url>"`, and `revisions --url "<url>"` to find a page, recover its HTML, and inspect history in a later session. Do not start a development server to view a published page.
