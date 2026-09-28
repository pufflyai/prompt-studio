# Prompt Studio documentation

Prompt Studio is a workbench where people and agents build and use tools through extensions. Core owns shared execution, workspaces, state, sync, trust, and workbench contracts. Planner, Notes, and Reports own their domain workflows. Read the [mission](../../MISSION.md) before changing product boundaries.

## Start here

- [Install and use Prompt Studio](0002-getting-started.md)
- [Set up repository development](development/0001-setup.md)
- [Run tests and validate changes](development/0002-testing.md)
- [Build an extension](extensions/0001-authoring.md)
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
| `requirements` | Product requirements, with current/proposed/superseded status |
| `adrs` | Architecture decisions, including temporary limitations and removal criteria |
| `lessons-learned` | Diagnosed failures and rules that prevent recurrence |

Use topic folders within categories. References are grouped into `architecture/`, `cli/`, `extensions/`, `sdk/`, and `workbench/`. Guides group development, extension authoring, and SDK workflows. Requirements group API, CLI, dashboard, extension, and platform topics.

Every file has a four-digit number within its own folder: `NNNN-kebab-case.md`. For example, `references/architecture/0001-adapters-and-features.md` and `references/sdk/0001-overview.md` belong to separate sequences. Avoid repeating a folder's topic in the filename. Keep published numbers stable and add the next number in that folder. ADRs and lessons retain their existing folders and identifiers; do not recycle removed numbers. Keep ADR proposal dates when their status changes. Package and extension READMEs, extension-owned product docs, and Pencil/design guidance stay beside their owners.

Use relative Markdown links so these pages work in repository browsers and editors. Treat source-linked type declarations as the signature authority. Requirements marked proposed describe future behavior; superseded records explain retired decisions.

## Guides

- [0002 — Start using Prompt Studio](0002-getting-started.md)

### Development

- [0001 — Development setup](development/0001-setup.md)
- [0002 — Tests](development/0002-testing.md)
- [0003 — Storybook coverage](development/0003-storybook-coverage.md)
- [0004 — Pull request area labels](development/0004-pull-request-labels.md)

### Extensions

- [0001 — Extensions](extensions/0001-authoring.md)
- [0002 — Workbench cookbook](extensions/0002-workbench-cookbook.md)
- [0003 — Extension automation cookbook](extensions/0003-automation.md)
- [0004 — Migrate an extension to remote execution](extensions/0004-remote-execution-migration.md)
- [0005 — Extension conformance and regression coverage](extensions/0005-conformance.md)
- [0006 — Extension runtime smoke checks](extensions/0006-smoke-checks.md)

### SDK

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

### CLI

- [0001 — Prompt Studio CLI](../references/cli/0001-overview.md)
- [0002 — CLI agents](../references/cli/0002-agents.md)
- [0003 — Product Requirements Document: CLI Runtime and API Setup](../references/cli/0003-setup.md)
- [0004 — CLI projects](../references/cli/0004-projects.md)
- [0005 — CLI workspaces](../references/cli/0005-workspaces.md)
- [0006 — CLI sessions](../references/cli/0006-sessions.md)
- [0007 — Remote automation](../references/cli/0007-automation.md)
- [0008 — CLI notifications](../references/cli/0008-notifications.md)

### Extensions

- [0001 — Extension API reference](../references/extensions/0001-api.md)
- [0002 — Extension manifest and installation](../references/extensions/0002-manifest-and-installation.md)
- [0003 — Extension commands and processes](../references/extensions/0003-command-and-process-api.md)
- [0004 — Extension contributions](../references/extensions/0004-contribution-api.md)
- [0005 — Extension webviews and storage](../references/extensions/0005-webview-and-storage-api.md)
- [0006 — Extension lifecycle automation](../references/extensions/0006-lifecycle-automation.md)
- [0007 — Durable extension work](../references/extensions/0007-durable-automation.md)
- [0008 — Workbench composition](../references/extensions/0008-contextual-workbench-composition.md)
- [0009 — Extension modes and layout](../references/extensions/0009-modes-and-layout.md)
- [0010 — Navigation and layout state](../references/extensions/0010-navigation-and-layout-state.md)
- [0011 — Extension Notifications](../references/extensions/0011-notifications.md)
- [0012 — Renderer Edit and Refresh Lifecycle](../references/extensions/0012-renderer-edit-refresh-lifecycle.md)
- [0013 — Dashboard UI contributions](../references/extensions/0013-workbench-attachments.md)

### SDK

- [0001 — SDK](../references/sdk/0001-overview.md)
- [0002 — Resource types](../references/sdk/0002-resources.md)
- [0003 — SDK method reference](../references/sdk/0003-api.md)

### Workbench

- [0001 — Workbench](../references/workbench/0001-overview.md)
- [0002 — Workbench API](../references/workbench/0002-api.md)
- [0003 — Contribution ownership](../references/workbench/0003-contribution-ownership.md)
- [0004 — Workbench navigation](../references/workbench/0004-navigation.md)

## Requirements

### API

- [0001 — Product Requirements Document: API and Runtime Logs](../requirements/api/0001-error-logs.md)

### CLI

- [0001 — CLI feedback and help](../requirements/cli/0001-feedback.md)
- [0002 — Superseded: generalized cross-session follow-up](../requirements/cli/0002-proposals-cross-session-follow-up.md)

### Dashboard

- [0001 — Beta features](../requirements/dashboard/0001-beta-features.md)
- [0002 — Repository documentation and the retired core docs panel](../requirements/dashboard/0002-documentation.md)
- [0003 — Dashboard browser page titles](../requirements/dashboard/0003-page-titles.md)
- [0004 — Product Requirements Document: Dashboard Sessions](../requirements/dashboard/0004-sessions.md)
- [0005 — Dashboard settings and folder projects](../requirements/dashboard/0005-settings.md)

### Extensions

- [0001 — Project extension runtime snapshot requirements](../requirements/extensions/0001-runtime-snapshots.md)

### Platform

- [0001 — Cross-Platform Support](../requirements/platform/0001-cross-platform-support.md)
- [0002 — Desktop distribution and updates](../requirements/platform/0002-desktop-distribution.md)
- [0003 — Product Requirements Document: Real-time Updates](../requirements/platform/0003-realtime-updates.md)
- [0004 — Templates and skills](../requirements/platform/0004-templates-and-skills.md)
- [0005 — Versioning and releases](../requirements/platform/0005-versioning-and-releases.md)

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
