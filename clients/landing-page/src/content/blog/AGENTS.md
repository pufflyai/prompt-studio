# Blog posts

Read the repository `MISSION.md`, the landing-page `AGENTS.md`, and the blog and media rules in `documentation/guides/0001-documentation.md` before writing.

## Content

- Write short, direct descriptions of what people can do and why it helps.
- Order release features by user impact. Lead with the most useful visible changes, then agent workflows, extension features, and smaller improvements.
- Cover every relevant new feature. Group related changes; omit internal refactors and minor fixes unless they change something useful to users.
- Keep paragraphs to one or two short sentences. Use brief lists for parallel improvements and `##` headings for sections.
- Put the first useful GIF in the first feature section. Place each later GIF next to the workflow it explains. Avoid a long introduction or a gallery at the end.
- Distinguish workbench capabilities from extension-owned workflows. Describe harness-dependent features accurately.

## Release sources and metadata

- Check published GitHub releases, excluding drafts. Read the target release's core, SDK, UI, workbench, and relevant extension changelogs.
- Use the release's actual publication timestamp, not the date its changelog was prepared. Preserve an existing publication date when correcting or illustrating a post.
- If the release is pending, label the post as a preview. Use the preview's publication date and links to pending changesets at a fixed commit. Never invent a release date or claim pending work has shipped.
- Once the release ships, replace preview wording and sources with the release notes and changelogs at its tag. If versioned changelogs have landed before the GitHub release, link their fixed commit and preserve the post's publication date; do not invent a GitHub publication timestamp.
- Include `title`, a short `description`, an unquoted `published` date or UTC timestamp, `author: aurelien-franky`, one supported `category`, and paired `image.light` and `image.dark` paths. Release posts use `category: release`.
- Do not store reading time. Do not duplicate the shared alpha notice.
- `AGENTS.md` is contributor guidance, not a post. Keep it excluded from the blog collection loader.

## Banners and recordings

- Follow the repository Shape Art skill. Give each post a distinct 1600 × 400 banner with light and dark backgrounds, the same seed and composition, and all six shape kinds allowed.
- Keep the PNGs and editable JSON recipes together under `blog/images/`. `design/art/` is an ignored draft folder; do not rely on untracked files in a production build.
- Record real UI interactions using Playwright against `bun run dev:playwright` and its printed Docker dashboard URL. Use a disposable project and sample content. Stop it with `bun run dev:playwright:down` afterward.
- Record one workflow per clip. Match sample data, actions, framing, and playback speed in light and dark variants. Trim setup, idle time, typing, and loading pauses while leaving time to read results.
- Keep shareable source recordings beside the GIFs in `documentation/images/`, with descriptive names prefixed by the post slug. Keep temporary browser state, tokens, logs, and capture scripts outside published assets.
- Export matching `-light.gif` and `-dark.gif` files. Show only the active theme's version using the site's themed-media support. Give each workflow useful alt text and a short caption.
- Label the capture build when it differs from the release. State when sample extensions or data change what users see. Do not imply an existing control is new without a release source.
- Never include credentials, personal paths, or private conversations. Screenshots explain static controls; GIFs explain movement.

## Verification

- Check every claim against release sources, and check metadata, relative paths, captions, and links.
- Build the landing page; do not add tests for editorial content, media, or collection configuration.
- Use Playwright to check the built article and blog index on desktop and mobile in both themes. Check for overflow, missing images, readable captions, and correct theme selection.
- Verify every served GIF has multiple frames and visibly changes during playback, after direct loading and navigation from the blog index. Image optimization must preserve animation.
- No changeset is needed for posts, media, or these instructions alone. Follow the repository rules if the task also changes released package behavior.
