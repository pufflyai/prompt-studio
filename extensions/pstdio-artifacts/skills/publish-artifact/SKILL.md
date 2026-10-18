---
name: publish-artifact
description: Publish a self-contained interactive HTML page into the Prompt Studio dashboard, or update an existing artifact.
---

Create one `.html` or `.htm` file under `.pstdio/extension-storage/pstdio-artifacts/drafts/<name>/` inside the active workspace. Keep any build sources, prototypes, screenshots, and other working files in that extension storage directory too. Never create `.pstdio/artifacts/` or `.pstdio/prototypes/`; see [Drafts, prototypes, and published artifacts](https://prompt.studio/docs/guides/extensions/extension-storage/#drafts-prototypes-and-published-artifacts). Set its `<title>`. Inline CSS and JavaScript and embed images/fonts as data URLs. Pages have no backend or host API access. Keep the HTML under 16 MiB. See [Limits](https://prompt.studio/docs/extensions/artifacts/#limits).

Use the supplied CSS variables so the page follows the dashboard theme: `--artifact-bg`, `--artifact-surface`, `--artifact-fg`, `--artifact-muted`, `--artifact-border`, `--artifact-accent`, and `--artifact-font`. The body gets the background, foreground, and font by default. Use the surface, muted, border, and accent variables for cards, captions, borders, and chart marks. Avoid fixed page colors. Variables and the root `data-theme="light"` or `"dark"` update live without resetting the page. CSS `prefers-color-scheme` and `light-dark()` also follow the dashboard. For canvas charts, redraw on theme changes by observing the root's `style` attribute; SVG and CSS charts update automatically when they use these variables. See [Pages that follow the theme](https://prompt.studio/docs/extensions/artifacts/#pages-that-follow-the-theme).

Publish with `pst pstdio-artifacts publish --file_path .pstdio/extension-storage/pstdio-artifacts/drafts/<name>/page.html --favicon "📦" --label "First draft"`.

The result includes `url`, `artifactId`, `revisionId`, and a dashboard navigation target. Give the user the internal dashboard URL. It is project-local navigation, not public hosting or sharing.

To update, edit the file and run the same command with `--url "<returned-url>"`. Always retain and pass the URL for updates. Omitting it creates a new artifact. Each publish preserves earlier revisions. See [Publish a page](https://prompt.studio/docs/extensions/artifacts/#publish-a-page).

Use `pst pstdio-artifacts list`, `read --url "<url>"`, and `revisions --url "<url>"` to find a page, recover its HTML, and inspect history in a later session. Do not start a development server to view a published page.
