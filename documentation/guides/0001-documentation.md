# Prompt Studio documentation

Prompt Studio is a workbench where people and agents build and use tools through extensions. Core owns shared execution, workspaces, state, sync, trust, and workbench contracts. Planner, Notes, and Reports own their domain workflows. Read the [mission](../../MISSION.md) before changing product boundaries.

## Start here

- [Install and use Prompt Studio](0013-getting-started.md)
- [Set up repository development](0002-development-setup.md)
- [Run tests and validate changes](0003-testing.md)
- [Build an extension](0006-extension-authoring.md)
- [Look up SDK methods](../references/0043-sdk-reference.md)
- [Check lessons when stuck](../lessons-learned/)

## Storage and product boundaries

Runtime state normally lives under `PSTDIO_HOME` (default `~/.pstdio`), including the PGlite database, workspaces, installed user extensions, and logs. A linked folder keeps identity/configuration under `.pstdio`; extensions own their project content and draft layouts. This repository's documentation lives in `documentation/`. It is not a database snapshot or an automatic dashboard content source.

The API and dashboard share an authenticated runtime. Core sync uses SSE. There is no optional Electric SQL/Postgres synchronization mode described by these docs. See [API architecture](../references/0003-architecture-api.md) and [projects](../references/0015-architecture-projects.md).

## Organization and numbering

| Category | Purpose |
| --- | --- |
| `guides` | Setup, development, testing, and task walkthroughs |
| `references` | API contracts, CLI commands, schemas, and architecture |
| `requirements` | Product requirements, with current/proposed/superseded status |
| `adrs` | Architecture decisions, including temporary limitations and removal criteria |
| `lessons-learned` | Diagnosed failures and rules that prevent recurrence |

Every file has a four-digit number within its category: `NNNN-kebab-case.md`. Keep published numbers stable. Add the next number; do not recycle removed numbers. ADR gaps preserve historical identifiers. Keep ADR proposal dates when their status changes. Package and extension READMEs, extension-owned product docs, and Pencil/design guidance stay beside their owners.

Use relative Markdown links so these pages work in repository browsers and editors. Treat source-linked type declarations as the signature authority. Requirements marked proposed describe future behavior; superseded records explain retired decisions.

## guides

- [0002 — Development setup](0002-development-setup.md)
- [0003 — Tests](0003-testing.md)
- [0004 — Storybook coverage](0004-storybook-coverage.md)
- [0005 — Pull request area labels](0005-pull-request-labels.md)
- [0006 — Extensions](0006-extension-authoring.md)
- [0007 — Workbench cookbook](0007-workbench-cookbook.md)
- [0008 — Extension automation cookbook](0008-extension-automation.md)
- [0009 — Migrate an extension to remote execution](0009-remote-execution-migration.md)
- [0010 — Extension conformance and regression coverage](0010-extension-conformance.md)
- [0011 — Extension runtime smoke checks](0011-extension-smoke-checks.md)
- [0012 — Client](0012-sdk-client.md)
- [0013 — Start using Prompt Studio](0013-getting-started.md)

## references

- [0001 — Adapters and Features](../references/0001-architecture-adapters-and-features.md)
- [0002 — Agents and extension harnesses](../references/0002-architecture-agents.md)
- [0003 — API](../references/0003-architecture-api.md)
- [0004 — Compiled CLI distribution](../references/0004-architecture-bun-compiled-distribution.md)
- [0005 — Control and execution planes](../references/0005-architecture-control-and-execution-planes.md)
- [0006 — Desktop application foundation](../references/0006-architecture-desktop.md)
- [0007 — Extension navigation](../references/0007-architecture-extension-navigation.md)
- [0008 — Extension resource identities](../references/0008-architecture-extension-resource-identities.md)
- [0009 — Extension workbench composition](../references/0009-architecture-extension-workbench-composition.md)
- [0010 — Extension runtime](../references/0010-architecture-extensions-runtime.md)
- [0011 — Extension Runtime Boundaries](../references/0011-architecture-hooks-runtime-boundaries.md)
- [0012 — Local and remote workspaces](../references/0012-architecture-local-and-remote.md)
- [0013 — Package Boundaries](../references/0013-architecture-package-boundaries.md)
- [0014 — Project extension runtime snapshots](../references/0014-architecture-project-extension-runtime-snapshots.md)
- [0015 — Projects and workspaces](../references/0015-architecture-projects.md)
- [0016 — Remote execution and automation](../references/0016-architecture-remote-execution-and-automation.md)
- [0017 — Service Layer](../references/0017-architecture-service-layer.md)
- [0018 — Session Queue](../references/0018-architecture-session-queue.md)
- [0019 — Session Status Lifecycle](../references/0019-architecture-session-status-lifecycle.md)
- [0020 — Sessions](../references/0020-architecture-sessions.md)
- [0021 — Streaming](../references/0021-architecture-stream.md)
- [0022 — Workspace Diff Presentation](../references/0022-architecture-workspace-diff-presentation.md)
- [0023 — Worktrees and Git operations](../references/0023-architecture-worktrees.md)
- [0024 — Extension API reference](../references/0024-extensions-api.md)
- [0025 — Extension lifecycle automation](../references/0025-extension-lifecycle-automation.md)
- [0026 — Workbench composition](../references/0026-extensions-contextual-workbench-composition.md)
- [0027 — Durable extension work](../references/0027-extensions-durable-automation.md)
- [0028 — Extension modes and layout](../references/0028-extensions-modes-and-layout.md)
- [0029 — Navigation and layout state](../references/0029-extensions-navigation-and-layout-state.md)
- [0030 — Extension Notifications](../references/0030-extensions-notifications.md)
- [0031 — Renderer Edit and Refresh Lifecycle](../references/0031-extensions-renderer-edit-refresh-lifecycle.md)
- [0032 — Dashboard UI contributions](../references/0032-extensions-workbench-attachments.md)
- [0033 — CLI agents](../references/0033-cli-agents.md)
- [0034 — Remote automation](../references/0034-cli-automation.md)
- [0035 — Prompt Studio CLI](../references/0035-cli.md)
- [0036 — CLI notifications](../references/0036-cli-notifications.md)
- [0037 — CLI projects](../references/0037-cli-projects.md)
- [0038 — CLI sessions](../references/0038-cli-sessions.md)
- [0039 — Product Requirements Document: CLI Runtime and API Setup](../references/0039-cli-setup.md)
- [0040 — CLI workspaces](../references/0040-cli-workspaces.md)
- [0041 — SDK](../references/0041-sdk.md)
- [0042 — Resource types](../references/0042-sdk-resources.md)
- [0043 — SDK method reference](../references/0043-sdk-reference.md)
- [0044 — Workbench API](../references/0044-workbench-api.md)
- [0045 — Contribution ownership](../references/0045-workbench-contribution-ownership.md)
- [0046 — Workbench](../references/0046-workbench.md)
- [0047 — Workbench navigation](../references/0047-workbench-navigation.md)
- [0048 — Extension manifest and installation](../references/0048-extension-manifest-and-installation.md)
- [0049 — Extension commands and processes](../references/0049-extension-command-and-process-api.md)
- [0050 — Extension contributions](../references/0050-extension-contribution-api.md)
- [0051 — Extension webviews and storage](../references/0051-extension-webview-and-storage-api.md)

## requirements

- [0001 — Project extension runtime snapshot requirements](../requirements/0001-extensions-runtime-snapshots.md)
- [0002 — Product Requirements Document: API and Runtime Logs](../requirements/0002-api-error-logs.md)
- [0003 — CLI feedback and help](../requirements/0003-cli-feedback.md)
- [0004 — Superseded: generalized cross-session follow-up](../requirements/0004-cli-proposals-cross-session-follow-up.md)
- [0005 — Beta features](../requirements/0005-dashboard-beta-features.md)
- [0006 — Repository documentation and the retired core docs panel](../requirements/0006-dashboard-documentation.md)
- [0007 — Dashboard browser page titles](../requirements/0007-dashboard-page-titles.md)
- [0008 — Product Requirements Document: Dashboard Sessions](../requirements/0008-dashboard-sessions.md)
- [0009 — Dashboard settings and folder projects](../requirements/0009-dashboard-settings.md)
- [0010 — Cross-Platform Support](../requirements/0010-platform-cross-platform-support.md)
- [0011 — Desktop distribution and updates](../requirements/0011-platform-desktop-distribution.md)
- [0012 — Product Requirements Document: Real-time Updates](../requirements/0012-platform-realtime-updates.md)
- [0013 — Templates and skills](../requirements/0013-platform-templates-and-skills.md)
- [0014 — Versioning and releases](../requirements/0014-platform-versioning-and-releases.md)

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

## lessons learned

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
