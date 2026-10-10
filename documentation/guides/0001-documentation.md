# Prompt Studio documentation

Prompt Studio is a workbench where people and agents build and use tools through extensions. Core owns shared execution, workspaces, state, sync, trust, and workbench contracts. Planner, Notes, and Reports own their domain workflows. Read the [mission](../../MISSION.md) before changing product boundaries.

## Start here

- [Install Prompt Studio](getting-started/0001-install.md)
- [Set up repository development](development/0001-setup.md)
- [Run tests and validate changes](development/0002-testing.md)
- [Write an extension](extensions/0001-authoring.md)
- [Look up SDK methods](../references/sdk/0003-api.md)
- [Check lessons when stuck](../lessons-learned)

## Storage and product boundaries

Runtime state normally lives under `PSTDIO_HOME` (default `~/.pstdio`), including the PGlite database, workspaces, installed user extensions, and logs. A linked folder keeps identity/configuration under `.pstdio`; extensions own their project content and draft layouts. This repository's documentation lives in `documentation/`. It is not a database snapshot or an automatic dashboard content source.

The API and dashboard share an authenticated runtime. Core sync uses SSE. There is no optional Electric SQL/Postgres synchronization mode described by these docs. See [API architecture](../references/architecture/0003-api.md) and [projects](../references/architecture/0015-projects.md).

## Organization and numbering

| Category | Purpose |
| --- | --- |
| `guides` | Setup, development, testing, and task walkthroughs |
| `references` | API contracts, CLI commands, schemas, and architecture |
| `requirements` | PRDs (product requirements documents), with current or proposed status |
| `adrs` | Architecture decisions, including temporary limitations and removal criteria |
| `lessons-learned` | Diagnosed failures and rules that prevent recurrence |

Use topic folders within categories. References are grouped into `architecture/`, `cli/`, `extensions/`, `sdk/`, and `workbench/`. Guides group getting started, concepts, development, extension authoring, and SDK workflows. Requirements group API, CLI, dashboard, extension, and platform topics.

Every file has a four-digit number within its own folder: `NNNN-kebab-case.md`. For example, `references/architecture/0001-adapters-and-features.md` and `references/sdk/0001-overview.md` belong to separate sequences. Avoid repeating a folder's topic in the filename. Keep published numbers stable and add the next number in that folder. ADRs and lessons retain their existing folders and identifiers; do not recycle removed numbers. Keep ADR proposal dates when their status changes. Package and extension READMEs, extension-owned product docs, and Pencil/design guidance stay beside their owners.

Treat source-linked type declarations as the signature authority. Call requirements documents PRDs, not proposals. Mark unimplemented PRDs as proposed and delete superseded PRDs. Preserve the remaining numbers when a PRD is removed; gaps do not need to be filled.

## Publishing to prompt.studio/docs

The website publishes some folders as the Docs tab at [prompt.studio/docs](https://prompt.studio/docs/). It reads these files straight from the repository at build time:

- Guides: `guides/getting-started/`, `guides/concepts/`, `guides/extensions/`, and `guides/sdk/`
- References: `references/cli/`, `references/extensions/`, `references/sdk/`, and `references/workbench/`
- Extensions: `extensions/<name>/README.md` and the numbered files in `extensions/<name>/docs/` for Planner, Notes, Reports, Artifacts, Remote Workspaces, the Claude Code, Codex, and OpenCode harnesses, and Extension Lab

Nothing else is published. This guide, `guides/development/`, `references/architecture/`, PRDs, ADRs, lessons learned, and `extensions/pstdio-planner/docs/superseded/` stay in the repository. The allow-list of published folders and their sidebar labels lives in `clients/landing-page/src/content/docs-topics.ts`. A folder that is not on that list is never published, so a new folder stays private until someone adds it.

Published pages are written for users and extension authors who read them on the website without the repository open. Keep contributor material, such as repository test commands and Docker development stacks, in `guides/development/` or in an extension's `AGENTS.md`.

Every published page follows these rules. The website build fails when a page breaks them.

- No frontmatter.
- The first line is a `# Title` heading. It is the page's sidebar label, so keep it short.
- The first block after the title is a plain paragraph of one or two sentences, ideally under 160 characters. It becomes the page's description for search engines and link previews.
- The file number sets the page order in the sidebar. The URL drops it: `references/cli/0006-sessions.md` becomes `/docs/references/cli/sessions/`. An extension's `README.md` is its overview page.
- Use `##` headings for sections. They form the page outline.

Link with relative paths to `.md` files, so the same markdown works on GitHub and on the website. A link to a published page becomes a website link. A link to any other repository file, such as an ADR or a source file, becomes a link to that file on GitHub `main`. A relative link to a missing file fails the build. Anchors such as `0006-sessions.md#create-a-session` use GitHub-style heading slugs.

## Screenshots and GIFs

Prefer short GIFs when movement explains a feature: entering a sidebar level, choosing an option, dragging a row, or reloading a tool. Use a still screenshot when someone mainly needs to find a control or read a screen. Record real app interactions with sample data; do not animate a mock screen to imply working behavior.

For every new UX GIF, record matching light and dark variants of the same workflow. Use the same sample data, framing, actions, and playback speed. Save them with `-light.gif` and `-dark.gif` suffixes. Show the variant for the page’s active theme, and verify both versions remain animated after direct loading and in-site navigation.

Keep each recording focused on one workflow, with enough time to read the result. Avoid unnecessary typing and loading pauses. Store GIFs beside screenshots in `documentation/images/`, link them with relative Markdown paths, and give them useful alt text and a caption. Label the capture version when showing an earlier release. Verify the production asset still has multiple frames and plays after in-site navigation; image optimization must not flatten it.

Add screenshots when they help someone find a control, understand a screen, or check the result of a workflow. Getting-started guides and tool walkthroughs should show the relevant workbench or settings screen. API signatures and terminal-only instructions usually do not need an image.

Keep the source images in `documentation/images/` with descriptive kebab-case names. Use relative Markdown image paths so the same image works in the repository and on the website. Reuse an existing image when it shows the same screen; do not keep a second copy in the website's public folder.

For example, from a guide in `guides/getting-started/`:

```md
![Workbench showing the project sidebar and the Start page.](../../images/workbench.png)
```

Capture the real app with `bun run dev:playwright`, using its printed dashboard URL. Use a disposable project and sample content. Capture both light and dark themes for UX GIFs; choose the clearest theme for still screenshots. Do not include credentials, private paths, or personal conversations. Stop the capture stack afterward with `bun run dev:playwright:down`.

Show enough of the workbench to explain where a tool lives. For settings, capture the dialog with its navigation and relevant controls, rather than the whole desktop. Keep text readable at the documentation's column width. Give every image useful alt text and a nearby sentence that explains what to look for. State when enabled extensions or sample data make the picture differ from a new project.

Update screenshots when the visible workflow changes. Build the website and check the images on desktop and mobile before publishing. The production image must include them; a source-folder mount must not be needed to serve documentation screenshots.

## Blog posts

Blog posts live in `clients/landing-page/src/content/blog/`. Their frontmatter has `title`, `description`, `published`, `category`, and an author ID from `src/content/blog-authors.ts`. Use `author: aurelien-franky` for Aurélien Franky. The author registry supplies the name and local avatar. Reading time is calculated from article text at 220 words per minute; do not store it in frontmatter.

Release article views show an alpha notice before the body: Prompt Studio is still in alpha. Its APIs and core feature set are not fully defined yet and can change day by day, introducing breaking changes until beta. Keep the shared notice in `PostView` consistent when the release stage changes.

Give each post one category: `release` for shipped versions and their changes, `thoughts` for ideas and personal essays, or `tool showcase` for a specific tool and how people and agents use it. The schema rejects missing or unknown categories. The list and article header show the category, and article metadata carries it as `articleSection`.

Every post has its own paired light and dark banners. Generate a distinct 4:1 piece with the repo-local Shape Art extension: `pst shape-art piece generate --id blog-<post-slug> --background ink --width 1600 --height 400`. Follow the [Shape Art skill](../../.pstdio/extensions/shape-art/skills/shape-art/SKILL.md). Allow all six shape kinds, including yellow commands and orange automation shapes. Save a second recipe with the same seed and composition on a paper background, using an `-light` suffix. Pieces in `design/art/` are ignored drafts. Copy each PNG and its editable JSON recipe together into the blog's `images/` folder before using them in a new post. Existing tracked banners can keep their current paths.

```yaml
image:
  light: ./images/blog-my-post-light.png
  dark: ./images/blog-my-post.png
```

Astro checks both source paths and optimizes the banners. The site shows the variant for its active theme; link previews use the light variant. Keep the original proportions and opaque backgrounds. Art is decorative; screenshots and GIFs in the body explain the actual product.

The blog list highlights the newest post with a wide banner and larger title. Older entries have no artwork in the list. Every card includes the author avatar/name, date, reading time, category, and description, and its whole area opens the post. Cards zoom slightly on hover and show a keyboard focus ring; reduced motion disables the zoom. Article pages keep their full banners. Use `##` headings for article sections: posts with at least two sections show the shared **On this page** outline on wide screens, with links to headings and a marker for the section being read.

Write `published` as an unquoted date or UTC timestamp. Use a release's actual publication timestamp for release posts, so posts about releases published on the same day sort correctly. Check published GitHub releases; exclude drafts. Link each release post to its release notes and relevant changelogs at that release tag. Describe selected changes in terms of what people can do, and distinguish platform features from extension workflows.

Keep an original post's publication date when adding images or correcting it. Reuse relevant documentation screenshots. Label a recent capture when it illustrates an older release, and do not imply that a pictured control was introduced in that release unless the changelog confirms it.

Follow the [blog instructions](../../clients/landing-page/src/content/blog/AGENTS.md) for concise feature ordering and recording checks. Markdown GIFs named `-light.gif` and `-dark.gif` use the page's active theme. Include both with matching alt text and one caption; the website hides the inactive variant.

## Guides

### Getting started

- [0001 — Install Prompt Studio](getting-started/0001-install.md)
- [0002 — Open a project](getting-started/0002-open-a-project.md)
- [0003 — Add tools](getting-started/0003-add-tools.md)
- [0004 — Run agents](getting-started/0004-run-agents.md)
- [0005 — Troubleshooting](getting-started/0005-troubleshooting.md)

### How Prompt Studio works

- [0001 — Projects and workspaces](concepts/0001-projects-and-workspaces.md)
- [0002 — Extensions](concepts/0002-extensions.md)
- [0003 — Agents and harnesses](concepts/0003-agents.md)
- [0004 — Local and remote work](concepts/0004-local-and-remote.md)

### Developer tools

- [0003 — Developer tools](0003-developer-tools.md)

### Development

- [0001 — Development setup](development/0001-setup.md)
- [0002 — Tests](development/0002-testing.md)
- [0003 — Storybook coverage](development/0003-storybook-coverage.md)
- [0004 — Pull request area labels](development/0004-pull-request-labels.md)
- [0005 — Extension conformance and regression coverage](development/0005-conformance.md)

### Build extensions

- [0001 — Write an extension](extensions/0001-authoring.md)
- [0002 — Workbench cookbook](extensions/0002-workbench-cookbook.md)
- [0003 — Automation cookbook](extensions/0003-automation.md)
- [0004 — Move to remote execution](extensions/0004-remote-execution-migration.md)
- [0006 — Smoke checks](extensions/0006-smoke-checks.md)
- [0007 — Make actions CLI-ready](extensions/0007-cli-ready-actions.md)

### Use the SDK

- [0001 — Client](sdk/0001-client.md)

## References

### Architecture

- [0001 — Adapters and Features](../references/architecture/0001-adapters-and-features.md)
- [0002 — Agents and extension harnesses](../references/architecture/0002-agents.md)
- [0003 — API](../references/architecture/0003-api.md)
- [0004 — Compiled CLI distribution](../references/architecture/0004-bun-compiled-distribution.md)
- [0005 — Control and execution planes](../references/architecture/0005-control-and-execution-planes.md)
- [0006 — Desktop application foundation](../references/architecture/0006-desktop.md)
- [0007 — Extension navigation](../references/architecture/0007-extension-navigation.md)
- [0008 — Extension resource identities](../references/architecture/0008-extension-resource-identities.md)
- [0009 — Extension workbench composition](../references/architecture/0009-extension-workbench-composition.md)
- [0010 — Extension runtime](../references/architecture/0010-extensions-runtime.md)
- [0011 — Extension Runtime Boundaries](../references/architecture/0011-hooks-runtime-boundaries.md)
- [0012 — Local and remote workspaces](../references/architecture/0012-local-and-remote.md)
- [0013 — Package Boundaries](../references/architecture/0013-package-boundaries.md)
- [0014 — Project extension runtime snapshots](../references/architecture/0014-project-extension-runtime-snapshots.md)
- [0015 — Projects and workspaces](../references/architecture/0015-projects.md)
- [0016 — Remote execution and automation](../references/architecture/0016-remote-execution-and-automation.md)
- [0017 — Service Layer](../references/architecture/0017-service-layer.md)
- [0018 — Session Queue](../references/architecture/0018-session-queue.md)
- [0019 — Session Status Lifecycle](../references/architecture/0019-session-status-lifecycle.md)
- [0020 — Sessions](../references/architecture/0020-sessions.md)
- [0021 — Streaming](../references/architecture/0021-stream.md)
- [0022 — Workspace Diff Presentation](../references/architecture/0022-workspace-diff-presentation.md)
- [0023 — Worktrees and Git operations](../references/architecture/0023-worktrees.md)
- [0024 — Extension API version checks](../references/architecture/0024-extension-api-version-checks.md)
- [0025 — Database upgrades](../references/architecture/0025-database-upgrades.md)

### CLI

- [0001 — Overview](../references/cli/0001-overview.md)
- [0002 — Agents](../references/cli/0002-agents.md)
- [0003 — Runtime commands](../references/cli/0003-setup.md)
- [0004 — Projects](../references/cli/0004-projects.md)
- [0005 — Workspaces](../references/cli/0005-workspaces.md)
- [0006 — Sessions](../references/cli/0006-sessions.md)
- [0007 — Remote automation](../references/cli/0007-automation.md)
- [0008 — Notifications](../references/cli/0008-notifications.md)
- [0009 — Board views](../references/cli/0009-board-views.md)

### Extension API

- [0001 — Overview](../references/extensions/0001-api.md)
- [0002 — Manifest and installation](../references/extensions/0002-manifest-and-installation.md)
- [0003 — Commands and processes](../references/extensions/0003-command-and-process-api.md)
- [0004 — Contributions](../references/extensions/0004-contribution-api.md)
- [0005 — Webviews and storage](../references/extensions/0005-webview-and-storage-api.md)
- [0006 — Lifecycle automation](../references/extensions/0006-lifecycle-automation.md)
- [0007 — Durable work](../references/extensions/0007-durable-automation.md)
- [0008 — Workbench composition](../references/extensions/0008-contextual-workbench-composition.md)
- [0009 — Modes and layout](../references/extensions/0009-modes-and-layout.md)
- [0010 — Navigation and layout state](../references/extensions/0010-navigation-and-layout-state.md)
- [0011 — Notifications](../references/extensions/0011-notifications.md)
- [0012 — Renderer edit and refresh](../references/extensions/0012-renderer-edit-refresh-lifecycle.md)
- [0014 — API versioning](../references/extensions/0014-api-versioning.md)
- [0015 — Harness commands and chat modes](../references/extensions/0015-harness-commands.md)
- [0016 — Workflow status migration](../references/extensions/0016-workflow-status-migration.md)

### SDK

- [0001 — Overview](../references/sdk/0001-overview.md)
- [0002 — Resource types](../references/sdk/0002-resources.md)
- [0003 — Method reference](../references/sdk/0003-api.md)

### Workbench

- [0001 — Overview](../references/workbench/0001-overview.md)
- [0002 — API](../references/workbench/0002-api.md)
- [0003 — Contribution ownership](../references/workbench/0003-contribution-ownership.md)
- [0004 — Navigation](../references/workbench/0004-navigation.md)

## PRDs

### API

- [0001 — PRD: API and Runtime Logs](../requirements/api/0001-error-logs.md)

### CLI

- [0001 — PRD: CLI feedback and help](../requirements/cli/0001-feedback.md)

### Dashboard

- [0001 — PRD: Beta features](../requirements/dashboard/0001-beta-features.md)
- [0003 — PRD: Dashboard browser page titles](../requirements/dashboard/0003-page-titles.md)
- [0004 — PRD: Dashboard Sessions](../requirements/dashboard/0004-sessions.md)
- [0005 — PRD: Dashboard settings and folder projects](../requirements/dashboard/0005-settings.md)
- [0006 — PRD: Composer modes and provider state](../requirements/dashboard/0006-composer-modes.md)

### Extensions

- [0001 — PRD: Project extension runtime snapshot requirements](../requirements/extensions/0001-runtime-snapshots.md)

### Platform

- [0001 — PRD: Cross-Platform Support](../requirements/platform/0001-cross-platform-support.md)
- [0002 — PRD: Desktop distribution and updates](../requirements/platform/0002-desktop-distribution.md)
- [0003 — PRD: Real-time Updates](../requirements/platform/0003-realtime-updates.md)
- [0004 — PRD: Templates and skills](../requirements/platform/0004-templates-and-skills.md)
- [0005 — PRD: Versioning and releases](../requirements/platform/0005-versioning-and-releases.md)

## ADRs

- [0001 — ADR: Unified Test Runner — bun test](../adrs/0001-unified-bun-test.md)
- [0002 — ADR: `PSTDIO_DRY_RUN` Environment Variable (Superseded)](../adrs/0002-superseded-dry-run-flag.md)
- [0003 — ADR: Replace `PSTDIO_DRY_RUN` With Fake Agent](../adrs/0003-replace-dry-run-with-fake-agent.md)
- [0004 — ADR: Test Environment Isolation via Bun Preload](../adrs/0004-test-env-isolation.md)
- [0005 — ADR: Run the Backend Dev Server Without `bun --watch`](../adrs/0005-no-watch-backend-dev-server.md)
- [0006 — ADR: Temporary Desktop Lifecycle Implementation Without Pencil](../adrs/0006-superseded-temporary-desktop-lifecycle-without-pencil.md)
- [0007 — ADR: Temporary Direct Terminal WebSocket Endpoint](../adrs/0007-temporary-direct-terminal-websocket-endpoint.md)
- [0008 — ADR: Capability-Secured Extension Webview Assets](../adrs/0008-capability-secured-extension-webview-assets.md)
- [0009 — ADR: Temporary Non-Blocking Bun Shutdown](../adrs/0009-temporary-non-blocking-bun-shutdown.md)
- [0010 — ADR: Temporary E2E Ubuntu Mirror Override](../adrs/0010-superseded-temporary-e2e-ubuntu-mirror.md)
- [0012 — ADR 0012: Temporary webview client type source](../adrs/0012-temporary-webview-client-type-source.md)
- [0013 — ADR: Temporary Windows Desktop Release Deferral](../adrs/0013-temporary-windows-desktop-release-deferral.md)
- [0014 — ADR 0014: Extension catalog as data](../adrs/0014-extension-catalog-as-data.md)
- [0015 — ADR 0015: Template content belongs to extensions — Temporary legacy migration](../adrs/0015-template-content-belongs-to-extensions-temporary-migration.md)
- [0016 — ADR 0016: keep the grouped collection renderer in core](../adrs/0016-collection-renderer-stays-in-core.md)
- [0017 — Temporary local dependency install context](../adrs/0017-temporary-local-dependency-install-context.md)
- [0018 — Temporary API test process isolation](../adrs/0018-temporary-api-test-process-isolation.md)
- [0019 — Temporary space-free Linux desktop package paths](../adrs/0019-temporary-linux-desktop-package-paths.md)
- [0020 — Temporary packaged debugger attachment order](../adrs/0020-temporary-packaged-debugger-attachment-order.md)
- [0021 — Temporary native title bar updates after the first show](../adrs/0021-temporary-title-bar-updates-after-first-show.md)
- [0022 — Temporary PocketCoder turn cursor](../adrs/0022-temporary-pocketcoder-turn-cursor.md)
- [0023 — Temporary keyboard drag activation barrier](../adrs/0023-temporary-keyboard-drag-activation-barrier.md)
- [0024 — Temporary Git subprocess pipe ownership](../adrs/0024-temporary-git-subprocess-pipe-ownership.md)
- [0025 — Temporary registry source for Electron node-gyp](../adrs/0025-temporary-electron-node-gyp-registry-source.md)
- [0026 — Temporary Bun bootstrap for browser CI containers](../adrs/0026-temporary-container-bun-bootstrap.md)
- [0028 — Temporary native build tool selection](../adrs/0028-temporary-native-build-tool-selection.md)
- [0029 — Temporary Chromium-only Playwright bundle](../adrs/0029-temporary-chromium-only-playwright-bundle.md)
- [0030 — Temporary workspace contract release bridge](../adrs/0030-temporary-workspace-contract-release-bridge.md)
- [0031 — ADR 0031: Release all core packages under one version](../adrs/0031-release-all-core-packages-under-one-version.md)
- [0032 — Temporary macOS desktop CI indexing isolation](../adrs/0032-temporary-macos-ci-indexing.md)
- [0033 — Temporary terminal foreground probe](../adrs/0033-temporary-terminal-foreground-probe.md)
- [0034 — Temporary file-backed extension connection secrets](../adrs/0034-temporary-file-connection-secret-store.md)
- [0035 — Temporary reconciliation for file-backed connection secrets](../adrs/0035-temporary-file-secret-reconciliation.md)
- [0036 — Temporary Windows install scenario isolation](../adrs/0036-temporary-windows-install-scenario-isolation.md)
- [0037 — Temporary startup window display at DOM readiness](../adrs/0037-temporary-startup-show-after-document-load.md)
- [0038 — Temporary landing page Bun runtime pin](../adrs/0038-temporary-landing-page-bun-runtime-pin.md)
- [0039 — Temporary Node Windows directory removal](../adrs/0039-temporary-node-windows-directory-removal.md)
- [0040 — Temporary export marker for bundled type files](../adrs/0040-temporary-dts-export-marker.md)
- [0041 — Temporary Windows extension dependency links](../adrs/0041-temporary-windows-extension-dependency-links.md)
- [0042 — Temporary docgen filter in the workbench Storybook](../adrs/0042-temporary-workbench-storybook-docgen-filter.md)
- [0043 — Temporary CI Docker Hub mirror](../adrs/0043-temporary-ci-docker-hub-mirror.md)
- [0044 — Temporary CI limits for heavy-setup tests](../adrs/0044-temporary-ci-limits-for-heavy-setup-tests.md)
- [0045 — Temporary Remotion React subpath alias](../adrs/0045-temporary-remotion-react-subpath-alias.md)
- [0046 — Let extension webviews write to the clipboard when they declare it](../adrs/0046-declared-webview-clipboard-writes.md)
- [0047 — Semantic versioning for the extension API](../adrs/0047-semantic-versioning-for-the-extension-api.md)
- [0048 — Motion Lab runtime studies](../adrs/0048-motion-lab-runtime-studies.md)
- [0049 — Temporary scroll content width override for panel tabs](../adrs/0049-temporary-scroll-content-width-override.md)
- [0050 — Reuse webview bundles across restarts](../adrs/0050-reuse-webview-bundles-across-restarts.md)
- [0051 — Temporary Motion Lab scene link pass (Superseded)](../adrs/0051-superseded-temporary-motion-scene-link-pass.md)
- [0052 — Temporary Codex question delivery confirmation](../adrs/0052-temporary-codex-question-delivery-confirmation.md)
- [0053 — Temporary webview move fallback](../adrs/0053-temporary-webview-move-fallback.md)
- [0054 — Browser sessions for the local runtime](../adrs/0054-browser-sessions-for-the-local-runtime.md)
- [0055 — Temporary webview guest message filter](../adrs/0055-temporary-webview-guest-message-filter.md)
- [0056 — Temporary KaTeX security override](../adrs/0056-temporary-katex-security-override.md)
- [0060 — Board views are core project data](../adrs/0060-shared-project-board-views.md)
- [0057 — Browser sessions in per-origin storage](../adrs/0057-browser-sessions-in-per-origin-storage.md)

- [0061 — Project resource anchors](../adrs/0061-project-resource-anchors.md)

- [0062 — Temporary Codex history identity migration](../adrs/0062-temporary-codex-history-identity-migration.md)
- [0063 — Temporary Claude literal slash input](../adrs/0063-temporary-claude-literal-slash-input.md)
- [0064 — Codex App Server runtime](../adrs/0064-codex-app-server-runtime.md)
- [0065 — Stream command results over the shared client stream](../adrs/0065-stream-command-results-over-the-shared-client-stream.md)

## Lessons learned

- [0001 — Check runtime support before using browser APIs](../lessons-learned/0001-no-bun-eventsource.md)
- [0002 — PGlite WAL Corruption](../lessons-learned/0002-pglite-wal-corruption.md)
- [0003 — Strict Query Validation on API Endpoints](../lessons-learned/0003-strict-query-validation.md)
- [0004 — TanStack DB `.select()` proxy strips fields](../lessons-learned/0004-tanstack-db-select-proxy.md)
- [0005 — Use diff summaries in list views](../lessons-learned/0005-diff-cpu-spike-on-kanban.md)
- [0006 — Keep session status side effects in one service](../lessons-learned/0006-session-status-hooks-missing-on-secondary-paths.md)
- [0007 — Claude Code Follow-up Resume Requires EOF](../lessons-learned/0007-claude-code-follow-up-resume-requires-eof.md)
- [0008 — Load conversation history before applying follow-up patches](../lessons-learned/0008-follow-up-message-ordering-in-claude-code-sessions.md)
- [0009 — Background work can keep a green test process alive](../lessons-learned/0009-execfilesync-blocks-bun-test-exit.md)
- [0010 — Session model selection contract regressions](../lessons-learned/0010-session-model-selection-contract-regressions.md)
- [0011 — `bun --watch` Corrupts the Dev Database](../lessons-learned/0011-bun-watch-corrupts-dev-db.md)
- [0012 — Recursive `fs.watch` on Linux crawls node_modules symlinks and hangs CI](../lessons-learned/0012-linux-recursive-fs-watch-crawls-node-modules.md)
- [0013 — Manually check installed user flows with an agent](../lessons-learned/0013-manually-check-installed-user-flows.md)
- [0014 — Fatal exit skips async cleanup](../lessons-learned/0014-fatal-exit-skips-async-cleanup.md)
