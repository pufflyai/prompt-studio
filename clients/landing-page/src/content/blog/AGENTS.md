# Blog posts

Read the repository `MISSION.md`, the landing-page `AGENTS.md`, and the blog and media rules in `documentation/guides/0001-documentation.md` before writing.

## Content

- Write short, direct descriptions of what people can do and why it helps.
- Start with the actual changes. Omit slogans, mood-setting introductions, and vague claims such as "a more flexible workbench" or "keep the conversation moving".
- Name the feature, explain the user benefit, and give a concrete example when useful. For example: "Prompt Studio 0.41 brings shared collection controls, movable tabs, and optional performance monitoring. Save a Ready to build ticket view to reuse its filters, keep a terminal beside your conversation, and pause an extension to check whether it slows the app."
- Use concrete feature or workflow categories for headings, such as "Collection controls", "Workbench tabs", "Performance monitoring", and "Planner". Avoid fluffy descriptions such as "Make the workbench feel familiar".
- Order release features by user impact. Lead with the most useful visible changes, then agent workflows, extension features, and smaller improvements.
- Cover every relevant new feature. Group related changes; omit internal refactors and minor fixes unless they change something useful to users.
- Keep paragraphs to one or two short sentences. Use brief lists for parallel improvements and `##` headings for sections.
- Put the first useful GIF in the first feature section. Place each later GIF next to the workflow it explains. Avoid a long introduction or a gallery at the end.
- Distinguish workbench capabilities from extension-owned workflows. Describe harness-dependent features accurately.

## Release sources and metadata

- Release titles contain only the product name and version: `Prompt Studio 0.41`. Do not add a subtitle, colon, tagline, or feature summary. Use the description and body for those details.
- Check published GitHub releases, excluding drafts. Read the target release's core, SDK, UI, workbench, and relevant extension changelogs.
- Use the release's actual publication timestamp, not the date its changelog was prepared. Preserve an existing publication date when correcting or illustrating a post.
- Prepare release posts in their final release voice. Keep them unpublished until the release ships; do not add preview or awaiting-publication wording to the article.
- Once the release ships, update sources to the release notes and changelogs at its tag. If versioned changelogs have landed before the GitHub release, link their fixed commit; do not invent a GitHub publication timestamp.
- Include `title`, a short `description`, an unquoted `published` date or UTC timestamp, `author: aurelien-franky`, one supported `category`, and paired `image.light` and `image.dark` paths. Release posts use `category: release`.
- Do not store reading time. Do not duplicate the shared alpha notice.
- `AGENTS.md` is contributor guidance, not a post. Keep it excluded from the blog collection loader.

## Unpublished drafts

- Save unpublished posts in `drafts/<slug>.md` under this folder. The blog loader reads only top-level post files, so drafts have no website page, document JSON, index entry, sidebar entry, search result, or sitemap entry. Never put drafts in `public/` or add them to the page catalog.
- Write the body for its publication after release. The draft folder controls publication status; readers do not need draft labels in the article. Link to relevant source at a fixed commit until the release tag exists.
- Drafts may omit `published` and banner paths until publication. Do not invent a release date or reuse another post's banner.
- A draft is not done until it is published. Before you finish a draft task, check the release with `gh release view pstdio@<version> --json isDraft,publishedAt`. If the release is published, publish the post in the same task. If it is not, create a planner ticket named "Publish the Prompt Studio <version> release post" so the publish step has an owner.

## Publish a draft

Publish a release post as soon as its GitHub release is published. Do these steps in one PR:

1. Run `gh release view pstdio@<version> --json isDraft,publishedAt`. Continue only if `isDraft` is `false`. Use `publishedAt` as the publication timestamp.
2. Compare the draft with the GitHub release notes and the changelogs at the release tag. Add shipped features the draft misses. Remove or correct claims about work that did not ship.
3. Move the file with `git mv drafts/<slug>.md <slug>.md`.
4. Fix relative paths for the new folder depth. Banners change from `../images/` to `./images/`. Links to `documentation/` lose one `../`.
5. Add `published: <publishedAt>` as an unquoted UTC timestamp. Check that the paired banners exist under `images/`.
6. Point the release sources at the release notes and the release tag.
7. Follow [Verification](#verification). The production build must now include the article, document JSON, blog index entry, search entry, and sitemap entry for the slug.

## Banners and recordings

- Follow the repository Shape Art skill. Give each post a distinct 1600 × 400 banner with light and dark backgrounds, the same seed and composition, and all six shape kinds allowed.
- Keep the PNGs and editable JSON recipes together under `blog/images/`. `design/art/` is an ignored draft folder; do not rely on untracked files in a production build.
- Record real UI interactions using Playwright against `bun run dev:playwright` and its printed Docker dashboard URL. Use a disposable project and sample content. Stop it with `bun run dev:playwright:down` afterward.
- Record one workflow per clip. Match sample data, actions, framing, and playback speed in light and dark variants. Trim setup, idle time, typing, and loading pauses while leaving time to read results.
- Show a visible cursor in every recording. Move it to the target before clicking, pause briefly so readers can see the target, and show click feedback. Keep the cursor visible during drag-and-drop and leave time to read the result.
- Use examples that match each tool's purpose. Project Search finds content within the project; do not present it as online research.
- Keep unrelated floating panels and chat bubble buttons out of recordings. Use normal workbench controls to close or reposition them before recording.
- Keep shareable source recordings beside the GIFs in `documentation/images/`, with descriptive names prefixed by the post slug. Keep temporary browser state, tokens, logs, and capture scripts outside published assets.
- Do not add "Light video" or "Dark video" links, or other links to the source recordings, to blog posts. Keep recordings as source assets; readers use the embedded GIF for their active theme.
- Export matching `-light.gif` and `-dark.gif` files. Show only the active theme's version using the site's themed-media support. Give each workflow useful alt text and a short caption.
- Label the capture build when it differs from the release. State when sample extensions or data change what users see. Do not imply an existing control is new without a release source.
- Never include credentials, personal paths, or private conversations. Screenshots explain static controls; GIFs explain movement.

## Verification

- Check every claim against release sources, and check metadata, relative paths, captions, and links.
- Build the landing page; do not add tests for editorial content, media, or collection configuration.
- For a draft, check that the production build has no article, document JSON, navigation metadata, search entry, or sitemap entry for its slug.
- Use Playwright to check the built article and blog index on desktop and mobile in both themes. Check for overflow, missing images, readable captions, and correct theme selection.
- Verify every served GIF has multiple frames and visibly changes during playback, after direct loading and navigation from the blog index. Image optimization must preserve animation.
- No changeset is needed for posts, media, or these instructions alone. Follow the repository rules if the task also changes released package behavior.
