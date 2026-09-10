# Desktop application foundation

Prompt Studio desktop is a private Electron client in `clients/desktop`. Electron is a native lifecycle coordinator around the existing `pstdio` Bun runtime and dashboard; it does not import API domain services or access PGlite.

## Process boundary

- Electron main discovers the default-home runtime descriptor or starts the packaged `pstdio serve --foreground --owner desktop --host 127.0.0.1 --port 0` sidecar.
- The Bun sidecar remains the only API, domain-service, extension, agent, terminal, storage, and database owner.
- The visible workbench is the existing runtime-served dashboard. Electron bundles only small startup, recovery, confirmation, and closing lifecycle surfaces.
- The preload exposes a frozen typed capability object. It never exposes raw IPC, filesystem, shell, environment, process, or runtime credentials.

The lifecycle state machine distinguishes discovery, spawn, readiness, workbench, active-work confirmation, closing, recovery, retry, and persistent detach. Electron creates the runtime instance ID before spawn and accepts only a descriptor with that exact ID, so a competing process cannot replace the child during readiness. A runtime control event or a clean exit from the owned child marks shutdown as intentional. The process exit can arrive before the HTTP event, so both signals share one notification path. Failed exits open recovery instead of leaving a blank dashboard.

Runtime discovery starts while the lifecycle document loads. The build renders the initial startup view and its design-system styles into the document. Electron shows the native window when that document finishes loading, then allows the workbench view to be created. Native visibility does not wait for the hidden renderer's first paint, which can stall under automation. Desktop keeps its starting state until both documents finish loading. React hydrates the startup view, subscribes to main, and reads the latest state. Hydration starts without waiting for animation frames, so lifecycle actions remain available when an occluded window stops painting. Reduced-motion styles apply before hydration. The lifecycle renderer stays mounted in the BrowserWindow while a sandboxed WebContentsView displays the workbench. Recovery reveals the existing lifecycle page without restarting its renderer or loading its bundle again.

The 15-second startup budget also cancels pending health requests during discovery and external-runtime verification. A runtime that accepts a connection without answering cannot leave the startup window waiting indefinitely. Cancellation preserves the existing descriptor and does not start a competing runtime.

Active-work confirmation hides the workbench view and reveals the lifecycle page in the same window. The workbench stays mounted, preserving its terminal connections, open resources, and unsaved input. The confirmation receives the backend-authoritative session, terminal, and job labels through the lifecycle state. Its narrow `cancelQuit` and `confirmQuit` preload actions are sender-checked like every other desktop capability. Cancel reveals the workbench and returns focus to it. Confirm asks Electron main to cancel activity, then Electron waits without a timeout for the owned runtime to exit.

If the runtime refuses confirmed shutdown, the lifecycle page changes from confirmation to recovery. A new quit attempt reads current runtime ownership and activity before offering confirmation again. The window owns one lifecycle renderer and at most one workbench view, which it closes when the window closes.

Extension processes started through `ctx.process.spawnDetached` are independent
of that managed activity. They survive desktop Quit and API shutdown through
`pst close`. The extension owns their cleanup. Packaged Electron tests execute a
real extension command and verify its heartbeat continues after each shutdown.

## Runtime ownership

Desktop attaches to any healthy descriptor for the default `PSTDIO_HOME`. A desktop-owned runtime is stopped only after the authenticated shutdown endpoint accepts the request. Active work returns a backend-authoritative summary and requires confirmation before cancellation. Desktop waits without a shutdown timeout and does not escalate to process signals.

A persistent runtime is detached. Ownership is rediscovered immediately before quit so an in-place `pst serve` promotion is observed and the promoted runtime is not stopped.

## Browser security

The workbench uses a dedicated session partition without the `persist:` prefix. Before dashboard load, Electron clears old cookies and calls the bearer-authenticated browser-session endpoint. The response provisions the session-only HttpOnly, same-origin, `SameSite=Strict` cookie; the descriptor token never crosses the preload boundary.

The ephemeral browser session deliberately discards credentials and browser storage between launches. Desktop keeps the selected project, each project's last resource, and ordered open project-tab IDs in Electron's user-data directory. Its typed preload API cannot write arbitrary workbench keys. Layout data, session selection, and unsent chat drafts stay in the ephemeral browser session and do not survive application quit. A normal browser continues to use `localStorage`. Runtime-served dashboard metadata also forces API and sync requests to remain same-origin, even when a source build supplied a different `VITE_API_BASE_URL`.

## Native title bar and project tabs

Electron uses a hidden title bar with native controls. macOS traffic lights sit at x=10, y=15 inside the 44-pixel bar. The UI reserves enough space for their native dimensions. Windows and Linux use a 44-pixel native window-controls overlay, and CSS title-bar environment values keep interactive content out of its safe area. The bar is draggable; tabs, close buttons, and the project picker are not. Startup, recovery, confirmation, and closing views reserve the same title-bar space.

Only the active surface renders a title bar. During the workbench state, the lifecycle view renders nothing while its state subscription remains mounted for recovery and quit confirmation. Electron combines native drag regions from covered renderers, so leaving the lifecycle title bar underneath the workbench would intercept mouse clicks on project tabs and the project picker. Chromium-injected clicks bypass this native hit test; packaged tests also check that the inactive lifecycle surface is absent after startup, recovery, and canceled quit.

The dashboard detects the frozen preload bridge's `getProjectTabs` and `setProjectTabs` methods. This capability enables the desktop tab controller and title bar. Browser sessions keep their existing project selector and automatic single-project selection.

The dashboard controller owns only the ordered open IDs. Selecting a tab and selecting a project in the picker call the existing project-selection command. The selected-project context remains the only active-project state. Project-scoped navigation and history continue through the existing workbench. Closing a tab selects its next neighbor, or the previous neighbor when closing the last item. Closing the only tab opens project selection. It never deletes a project or cancels that project's work.

Electron's `DesktopProjectTabsStore` persists only `{ projectIds: string[] }` in `project-tabs.json`. It validates IDs, serializes atomic writes, and finishes pending writes before quit. Missing or invalid files start with an empty list. The dashboard removes deleted IDs after initial project sync and refreshes tab labels when project data arrives. This persistence does not retain runtime tokens or general browser storage.

A failed write shows an error through the workbench notification system. Tabs remain usable. The next tab change saves the full current order and dismisses the error after a successful write.

`@pstdio/ui` owns the title-bar and tab recipes from Pencil node `Q1dRGx`. `@pstdio/workbench` provides a generic `titleBar` slot above its regions and inside its theme. It has no project or Electron knowledge.

Run the real packaged tab flow with:

```bash
bun run --cwd clients/desktop package
bun run --cwd clients/desktop test:packaged --grep 'opens, switches, closes'
```

The flow opens two projects through the picker, switches tabs, restores project navigation, closes the active tab without stopping its terminal, and restores tab order after relaunch. It checks the expected lifecycle and workbench renderers and an unchanged runtime ID and PID, then attaches `desktop-project-tabs.png` while two tabs are visible. Source Electron checks also verify that both renderers share one native window. Storybook's `Components/Navigation/Window Tabs` covers light and dark themes, overflow, long names, keyboard selection, and close hover/focus.

BrowserWindow enables sandboxing, context isolation, web security, and disables Node integration and webviews. The bundled lifecycle renderer is served from the privileged `pstdio://lifecycle/` protocol, restricted to files under its renderer root. It does not use the broader `file://` protocol. The shell:

- allows main-frame navigation only within the exact runtime origin or the exact bundled lifecycle document;
- denies popup creation and opens only validated HTTPS links through the operating system;
- denies permissions by default;
- applies a restrictive content security policy;
- validates the expected WebContents, main frame, and exact renderer origin for every IPC handler.

The lifecycle and workbench renderers use the same hardened web preferences and memory-only session. The lifecycle renderer allows navigation only to its bundled document. Both owned WebContents are checked for IPC; the state-change subscription exposes the state payload without the Electron event object. Confirmation uses an alert-dialog role, focuses the safe action first, supports keyboard-only choice, and uses the shared destructive button variant for cancellation. Startup and closing progress indicators are omitted when the operating system requests reduced motion.

## Recovery and diagnostics

The workbench registers file rendering without loading its editor implementation. Code and diff editor components initialize the bundled Monaco runtime when first rendered. Opening a desktop window with no file open does not download or initialize Monaco.

Recovery codes distinguish a missing sidecar, readiness timeout, port bind failure, PGlite ownership conflict, PGlite recovery failure, uncertain runtime ownership, and unexpected exit. Recovery never recommends deleting the database.

The runtime's `db.open.failed` event identifies database startup failures even when PGlite returns an opaque WebAssembly error. Desktop uses that event to show database recovery guidance. It leaves damaged files untouched and can retry after the user restores them.

The main thread stays available during sidecar verification. It streams the executable checksum and awaits the version subprocess under the startup deadline. The lifecycle protocol reads packaged files directly with their content types. It does not route local asset reads through Electron's networking service.

Open logs reveals the shared Prompt Studio log file. Copy diagnostics contains only application/runtime versions, platform and architecture, lifecycle state, safe loopback origin, owner PID/type, log path, and bounded process output. Runtime tokens, bearer headers, URL credentials, and named secrets are redacted.

## Packaged layout

Electron Forge builds one application target at a time. Its pre-package hook builds the dashboard and combined runtime, compiles only the matching runtime target, stages it, validates it, and then builds Electron main, preload, and lifecycle renderer bundles.

The installed application layout keeps code and native runtime concerns separate:

```text
resources/
├── app.asar
└── bin/
    ├── pstdio[.exe]
    └── pstdio.manifest.json
```

`app.asar` contains the Electron application. The architecture-matched Bun executable stays outside ASAR with executable permissions. Its manifest records the schema, platform, architecture, application version, executable name, and SHA-256 checksum. Desktop validates the target, permissions, checksum, manifest version, and executable-reported version before spawning it. A corrupt or incompatible package opens recovery with reinstall guidance and is never launched.

macOS release staging signs the Bun runtime with the release identity, hardened runtime, a secure timestamp, and the JIT entitlement before computing its checksum. Forge preserves that nested signature when signing the enclosing application. Signing the runtime again would change its bytes and invalidate the manifest. The packaged launch suite checks the final signed application, so this ordering is part of release validation.

Active release targets are Apple Silicon macOS arm64 and Linux x64. Intel macOS
desktop distribution is deferred after native startup and packaged test deadlines
failed. Windows desktop distribution remains deferred until trusted signing is
available. Forge retains their packaging support, but CI does not build or publish
those desktop targets. Intel macOS and Windows CLI packages remain supported.
Forge produces ZIP and DMG artifacts on macOS and
ZIP and DEB artifacts on Linux. The package enables ASAR integrity and an
explicit full Electron fuse policy that disables Node execution, Node options,
CLI inspection, and privileged `file://` behavior.

## Native releases and updates

Desktop artifacts ship on the matching `pstdio@<version>` GitHub release. The
private desktop package version is synchronized from `packages/pstdio` by the
Changesets version command. Native release preparation rejects any drift between
the Electron application, compiled sidecar, installer, sidecar manifest, and
update metadata.

`.github/workflows/release-desktop.yml` runs this native matrix:

| Target | Native output | Release verification | Update path |
| --- | --- | --- | --- |
| macOS arm64 | DMG and ZIP | Developer ID signature, notarization staple, Gatekeeper, clean-home launch | Electron updater through release-owned JSON metadata |
| Linux x64 | DEB and portable ZIP | DEB inspection and clean-home launch | Distribution package manager or GitHub release page |

Every target audits the packaged Electron fuse wire and emits a target manifest
plus SHA-256 checksums. The publish job requires the complete two-target set,
revalidates every checksum and component version, uploads the artifacts to the
existing draft release, and only then publishes it. Native jobs receive read-only
repository access; only the final publisher receives `contents: write`.

The active native updater is configured only in a packaged macOS app. It resolves
the newest complete `pstdio@<version>` release and points Electron at that
release's update metadata. This avoids depending on services that require plain
SemVer Git tags, which do not match the monorepo tag format. Source builds and
Linux open the release page instead. The deferred Windows updater code remains
inactive until the signed Windows lane returns. Release assets keep explicit
platform and architecture names.

## Development and tests

Run the real desktop development flow from the repository root:

```bash
bun run dev:desktop
```

This builds the Electron client, starts the Docker-isolated unified runtime, seeds its project, and attaches Electron to that authenticated external runtime. Its home is repository-local under `__test-tmp__/dev-isolated/pstdio-desktop/`; it never defaults to `~/.pstdio`. Closing Electron detaches from the externally owned runtime and tears down the Compose project and its isolated state.

Cold dependency installation and compilation can take longer than 90 seconds. The host waits while that setup container runs. After setup starts the API process, the container allows 90 seconds for API health and the desktop descriptor, aborts stalled health requests, and exits on failure. The host then reports the container logs instead of waiting indefinitely for a failed runtime.

Use `bun run dev` for the source API plus Vite dashboard, or `bun run dev:isolated` for the browser-oriented Docker flow. Only `dev:desktop` starts Electron.

Run focused desktop validation with:

```bash
bun run --cwd clients/desktop test
bun run --cwd clients/desktop test:electron
bun run --cwd clients/desktop package
bun run --cwd clients/desktop test:packaged
bun run --cwd clients/desktop make -- --skip-package
bun run --cwd clients/desktop verify:fuses
```

Use Node 24, the same version as CI, for Electron Forge packaging.

The source Electron suite starts isolated temporary homes and a real Electron process. It checks authenticated attachment, the sandboxed/frozen preload boundary, ephemeral cookie storage, denied popups and permissions, single-instance focus, persistent-runtime detach, and actionable recovery. The packaged suite launches the produced application itself over the Chromium debugging protocol without enabling Electron's disabled Node inspector. It measures the cold-start, warm-attach, and crash-recovery budgets; creates and lists a project through the HttpOnly browser session and descriptor-bearer CLI; promotes ownership without restarting the runtime; proves persistent detach plus project and workbench-state restoration; exercises intentional `pst close`; and retries an unexpected sidecar exit without relaunching Electron.

Packaged startup recovery tests start a real persistent runtime through its bundled CLI. On macOS and Linux, suspending that process proves the startup deadline reaches an actionable recovery view and preserves its descriptor. Resuming it and pressing Retry through the keyboard attaches the same runtime in the same window. A separate test repairs a mismatched instance ID after ownership recovery, then verifies attachment to the original owner. Both flows stop the runtime through `pst close` and remove their isolated homes.

Database recovery tests use temporary homes. They verify that a competing database owner remains healthy and that desktop retries after it stops. They also damage an isolated database control file, verify that recovery preserves it, and restore its original contents before retrying. These tests use the packaged CLI and never open the database directly.

Detached-work tests install a small command-only fixture from `packages/workbench-fixture/fixtures/detached-work`. Its only dependency is the public SDK. Installation runs normally in each isolated home, and the tests verify that its process continues after either desktop quit or API shutdown.

Workbench startup and recovery measurements sample element visibility on animation frames and return the timestamp from the renderer. Startup-window timing uses the later of the native window's first `show` event and the lifecycle document's first contentful paint. The native event also verifies that the window is visible. The controller shows the prerendered startup document at DOM readiness, before remaining resources finish loading or the workbench view is created, so a fast attachment cannot cover the startup renderer while the window is still hidden. Runtime discovery and sidecar verification start after the lifecycle page loads, so checksum reads and process startup do not compete with the initial window display. Both timings are measured from process launch, including time before the debugger attaches. Assertion polling, protocol replies, and trace snapshots must not add time after the UI is visible. The limits are 8 seconds for cold startup, 3 seconds for warm attach, and 500 milliseconds for crash recovery. The startup window must appear in less than 1.5 seconds on macOS and less than 1 second on Linux, on both cold launches and warm attachment. The supported desktop release targets are Apple Silicon and Linux; Intel desktop support remains deferred.

Pull-request CI runs both Electron suites on Linux and Apple Silicon before downstream Docker
builds can run. It configures the SUID sandbox for the source and packaged
executables, verifies the packaged fuse policy, and uploads readiness results
and browser traces. Trace export removes runtime cookies and bearer
credentials from every text entry before artifacts are uploaded.

The secured compiled-runtime browser suite runs Chromium, Firefox, and WebKit.
`bun run --cwd packages/e2e test:packaged` runs the compiled CLI checks with Bun and the browser checks with the Playwright runner.
It proves opaque iframe command and project-setting persistence across reloads.
Chromium also sends a terminal sentinel through the runtime's ephemeral,
cookie-authenticated WebSocket endpoint and closes the terminal. CI requires
the browser binaries and fails instead of skipping missing engines. These
checks complement the Vite browser suite, which covers the development
transport, and signed native release tests, which cover distribution trust.

Run `bun run --cwd scripts verify:packages` whenever packaged defaults change. It verifies the compiled runtime's embedded dashboard, migrations, built-in extensions, and host-platform runtime behavior.

## Sidecar troubleshooting

Package recovery distinguishes these failures before process launch:

- `missing_sidecar`: the executable or manifest is absent;
- `unsupported_target` or `target_mismatch`: the current platform/architecture has no package or the staged manifest names another target;
- `invalid_permissions`: the POSIX executable bit was lost;
- `invalid_manifest` or `checksum_mismatch`: package metadata or bytes are corrupt;
- `version_mismatch`: Electron, the manifest, and `pstdio --version` disagree.

Rebuild with `bun run --cwd clients/desktop package`. If an installed package reports one of these failures, reinstall the matching package artifact; do not copy an arbitrary CLI into `resources/bin` or point source Electron at a production-home runtime.

Release-only failures are fail closed. Missing signing credentials, an invalid
native signature, a failed notarization staple, an incomplete artifact matrix,
or version/checksum drift leaves the GitHub release in draft. See [Desktop
distribution and updates](/product/platform/desktop-distribution) for credential
names, verification commands, and operator recovery.
