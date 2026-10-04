# Desktop application foundation

Prompt Studio desktop is a private Electron client in `clients/desktop`. Electron is a native lifecycle coordinator around the existing `pstdio` Bun runtime and dashboard; it does not import API domain services or access PGlite.

## Process boundary

- Electron main discovers the default-home runtime descriptor or starts the packaged `pstdio serve --foreground --owner desktop --host 127.0.0.1 --port 0` sidecar.
- The Bun sidecar remains the only API, domain-service, extension, agent, terminal, storage, and database owner.
- The visible workbench is the existing runtime-served dashboard. Electron bundles only small startup, recovery, and closing lifecycle surfaces. The quit confirmation is a dialog inside the dashboard.
- The preload exposes a frozen typed capability object. It never exposes raw IPC, filesystem, shell, environment, process, or runtime credentials.

Before starting a new sidecar on macOS or Linux, desktop reads `PATH` from the user's configured interactive login shell. This lets Finder and desktop launchers find the same user-installed harnesses as a terminal, including tools configured in shell startup files. Only `PATH` is adopted; runtime settings and credentials remain those of the launching process. Windows keeps its inherited environment. Attaching to an existing runtime does not run a shell.

Shell path resolution shares the existing 15-second startup deadline. The shell receives a login process name and interactive mode, which also supports csh and tcsh without combining their incompatible login and command flags. Resolution owns a separate process group. Cancellation kills that group and waits for the shell to close, so slow startup commands cannot survive the deadline. If shell startup fails or returns no path, desktop shows startup recovery instead of silently marking installed harnesses unavailable.

The lifecycle state machine distinguishes discovery, spawn, readiness, workbench, active-work confirmation, closing, recovery, retry, and persistent detach. Electron creates the runtime instance ID before spawn and accepts only a descriptor with that exact ID, so a competing process cannot replace the child during readiness. A runtime control event or a clean exit from the owned child marks shutdown as intentional. The process exit can arrive before the HTTP event, so both signals share one notification path. Failed exits open recovery instead of leaving a blank dashboard.

Runtime discovery starts while the lifecycle document loads. The build renders the initial startup view and its design-system styles into the document. Electron shows the native window when that document finishes loading, then allows the workbench view to be created. Native visibility does not wait for the hidden renderer's first paint, which can stall under automation. Desktop keeps its starting state until both documents finish loading. React hydrates the startup view, subscribes to main, and reads the latest state. Hydration starts without waiting for animation frames, so lifecycle actions remain available when an occluded window stops painting. Reduced-motion styles apply before hydration. The lifecycle renderer stays mounted in the BrowserWindow while a sandboxed WebContentsView displays the workbench. Recovery reveals the existing lifecycle page without restarting its renderer or loading its bundle again.

The 15-second startup budget also cancels pending health requests during discovery and external-runtime verification. A runtime that accepts a connection without answering cannot leave the startup window waiting indefinitely. Cancellation preserves the existing descriptor and does not start a competing runtime.

Active-work confirmation is a modal dialog in the workbench, in the current theme. Electron main sends lifecycle state to both renderers. The dashboard's `DesktopQuitConfirmation` opens the dialog for the `confirming_active_work` state and lists the backend-authoritative session, terminal, and job labels from that state. The workbench stays visible and mounted behind the dialog, preserving its terminal connections, open resources, and unsaved input. The lifecycle page renders nothing in this state. The dialog's narrow `cancelQuit` and `confirmQuit` preload actions are sender-checked like every other desktop capability. Cancel and Escape close the dialog and return focus to the workbench. Confirm asks Electron main to cancel activity and reveals the closing screen, then Electron waits without a timeout for the owned runtime to exit.

The dialog can only appear in a working workbench renderer. If the workbench view is missing, its renderer has crashed, or it shows another origin than the current runtime, Electron loads the workbench again before it waits for a choice. The new page reads the current lifecycle state and opens the dialog. A quit during startup joins the workbench load already in progress instead of starting a second one. If that load fails, the lifecycle page shows recovery and the next quit starts over. A runtime crash during confirmation also opens recovery and lets a later quit start over. If the person asks to quit again while the confirmation is open, for example because the dashboard failed to load and shows no dialog, Electron asks with a native message box that offers the same two choices.

If the runtime refuses confirmed shutdown, the lifecycle page shows recovery. A new quit attempt reads current runtime ownership and activity before offering confirmation again, over the workbench. The window owns one lifecycle renderer and at most one workbench view, which it closes when the window closes.

Extension processes started through `ctx.process.spawnDetached` are independent
of that managed activity. They survive desktop Quit and API shutdown through
`pst close`. The extension owns their cleanup. Packaged Electron tests execute a
real extension command and verify its heartbeat continues after each shutdown.

## Runtime ownership

Desktop attaches to any healthy descriptor for the default `PSTDIO_HOME`. A desktop-owned runtime is stopped only after the authenticated shutdown endpoint accepts the request. Active work returns a backend-authoritative summary and requires confirmation before cancellation. Desktop waits without a shutdown timeout and does not escalate to process signals.

A persistent runtime is detached. Ownership is rediscovered immediately before quit so an in-place `pst serve` promotion is observed and the promoted runtime is not stopped.

## Browser security

The workbench uses a dedicated session partition without the `persist:` prefix. Before dashboard load, Electron clears old cookies and calls the bearer-authenticated browser-session endpoint. The response provisions the session-only HttpOnly, same-origin, `SameSite=Strict` cookie; the descriptor token never crosses the preload boundary.

The ephemeral browser session deliberately discards credentials and browser storage between launches. Desktop keeps the dashboard's saved state in Electron's user-data directory instead. `workbench-state.json` holds every value the dashboard writes to its storage adapter, keyed by its browser storage key: the selected project, each project's last location, layouts and region state including the Side Panel, panel menus, tree expansion, the selected session, kanban board settings, and the theme choice, including per-mode choices. Existing files with selectedProjectId and pageLocations load into the same value map, preserving project and page selection. Native layouts are sent without a renderer debounce so an immediate Quit does not drop the latest change. The dashboard hydrates these values before rendering and supplies the same adapter to the workbench, to `KanbanRendererStorageProvider`, and as `Workbench`'s `themeStorage`, so `ThemePreferenceProvider` saves the theme choice there instead of in `localStorage`. Each change goes through the typed preload's single `setWorkbenchItem(key, value)` method. The main process keeps the values in memory, coalesces bursts into one atomic file write, and writes any pending change before quit. Unsent chat drafts never reach Electron; they stay in the ephemeral browser session and do not survive application quit. `project-tabs.json` holds the ordered open project-tab IDs. A normal browser continues to use `localStorage`. Runtime-served dashboard metadata also forces API and sync requests to remain same-origin, even when a source build supplied a different `VITE_API_BASE_URL`.

## Native title bar and project tabs

Electron uses a hidden title bar with native controls. macOS traffic lights sit at x=10, y=15 inside the 44-pixel bar. Tabs start at x=90 in a normal window and x=10 in native full screen. The native window owns full-screen state. Its events update a `data-window-full-screen` document attribute through the preload, which also reads the current state after each document load. The shared recipe uses that attribute to release the controls' space. No layout preference or React state duplicates the native state.

Windows and Linux use a 44-pixel native window-controls overlay, and CSS title-bar environment values keep interactive content out of its safe area. The title bar uses the app background token without a bottom border. The bar is draggable; tabs, close buttons, and the project picker are not. Startup, recovery, and closing views use the same recipe.

Only the active surface renders a title bar. During the workbench and quit-confirmation states, the lifecycle view renders nothing while its state subscription remains mounted for recovery and closing. Electron combines native drag regions from covered renderers, so leaving the lifecycle title bar underneath the workbench would intercept mouse clicks on project tabs and the project picker. Chromium-injected clicks bypass this native hit test; packaged tests also check that the inactive lifecycle surface is absent after startup, recovery, while the quit dialog is open, and after canceled quit.

The dashboard detects the frozen preload bridge's `getProjectTabs` and `setProjectTabs` methods. This capability enables the desktop tab controller and title bar. Browser sessions keep their existing project selector and automatic single-project selection.

The dashboard controller owns only the ordered open IDs. Selecting a tab and selecting a project in the picker call the existing project-selection command. The selected-project context remains the only active-project state. Before publishing a new selection, the command detaches the outgoing page so extension teardown cannot replace its saved location with Start. Page removal only restores a fallback when an active page location existed. The next project restores its own last page and resource after its extensions are ready. Closing a tab selects its next neighbor, or the previous neighbor when closing the last item. Closing the only tab opens project selection. It never deletes a project or cancels that project's work.

Drag a project tab horizontally to reorder it. Keyboard users focus the tab, press Space to pick it up, use the arrow keys to move it, and press Space to drop or Escape to cancel. Reordering keeps the selected project and its page unchanged. The controller saves the resulting order through the existing tab store, so it survives reload and application restart.

Electron's `DesktopProjectTabsStore` persists only `{ projectIds: string[] }` in `project-tabs.json`. It validates IDs, serializes atomic writes, and finishes pending writes before quit. Missing or invalid files start with an empty list. The dashboard removes deleted IDs after initial project sync and refreshes tab labels when project data arrives. This persistence does not retain runtime tokens or general browser storage.

A failed write shows an error through the workbench notification system. Tabs remain usable. The next tab change saves the full current order and dismisses the error after a successful write.

`@pstdio/ui` owns the title-bar and tab recipes. Pencil node `V3OnvZ` defines the workbench; `iGFTr` shows normal and full-screen desktop title bars. `@pstdio/workbench` provides a generic `titleBar` slot above its regions and inside its theme. It has no project or Electron knowledge.

## Theme

Every desktop screen uses the person's chosen theme. The dashboard saves the theme choice, including per-mode choices, through desktop storage (see [Browser security](#browser-security)). Electron also saves the theme the workbench last showed: its ID, light or dark mode, token overrides, and computed background color. The dashboard's `DesktopStartupAppearance` component reports it through the `setStartupAppearance` preload action whenever the shown theme changes. This record is a cache. It exists because extension theme colors are not available until the runtime and its extensions start.

The lifecycle protocol serves `index.html` with that theme's classes, `data-theme`, `data-color-mode`, `color-scheme`, and token overrides on `<html>`, so the first frame matches before any script runs. The native window background uses the saved color. After hydration, the lifecycle page gives the saved theme to `ThemePreferenceProvider` and follows later reports, so recovery and closing screens match a theme change made during the session. It reads the saved theme again after subscribing, because the workbench can report while the page hydrates. With nothing saved, the lifecycle page follows the system light or dark setting. While a chosen extension theme is still registering, `useThemePreference()` reports it as `pendingThemePreference` and the dashboard shows a fallback. The dashboard does not report that fallback, so it never replaces the saved appearance. Electron rejects an appearance with an unknown mode or an unsupported background color, and leaves out token values that could end a CSS declaration or an HTML attribute.

## Native menus and icon

Edit keeps native undo, redo, clipboard, and selection actions, and adds Settings and Keyboard Shortcuts. View opens Search, the project picker, notifications, and theme selection. It also offers sidebar visibility, history navigation, reload, zoom, and full screen. The menu does not expose developer tools.

App menu items send command IDs only to the workbench renderer through the preload's `onCommand` subscription. The dashboard executes its registered commands and reports failures through workbench notifications. Lifecycle state enables those items only while the workbench is ready. Settings uses Cmd/Ctrl+,; existing workbench shortcuts remain owned by the workbench so native accelerators do not override editor shortcuts.

`clients/desktop/assets/icon-mac.svg` defines the Mac icon's white rounded-square background and existing Prompt Studio mark. `bun run --cwd clients/desktop icons:generate` renders it into `icon.icns`. The same script renders Windows and Linux assets from `icon.svg`.

Run the real packaged tab flow with:

```bash
bun run --cwd clients/desktop package
bun run --cwd clients/desktop test:packaged --grep 'opens, switches, closes'
```

The flow opens two projects through the picker and restores a different page in each, including an extension page. It reorders tabs with the pointer and keyboard, cancels a move, closes the active tab without stopping its terminal, and restores the page and tab order after relaunch. It checks the expected lifecycle and workbench renderers and an unchanged runtime ID and PID, then attaches `desktop-project-tabs.png` while two tabs are visible. Source Electron checks also verify that both renderers share one native window. Storybook's `Components/Navigation/Window Tabs` covers light and dark themes, overflow, long names, keyboard selection and reordering, and close hover/focus.

BrowserWindow enables sandboxing, context isolation, web security, and disables Node integration and webviews. The bundled lifecycle renderer is served from the privileged `pstdio://lifecycle/` protocol, restricted to files under its renderer root. It does not use the broader `file://` protocol. The shell:

- allows main-frame navigation only within the exact runtime origin or the exact bundled lifecycle document;
- denies popup creation and opens validated HTTP and HTTPS links, including local preview URLs and custom ports, through the operating system; URLs with credentials and non-web schemes remain blocked;
- denies permissions by default, allowing only clipboard writes from the main runtime page and from extension webviews on their own `<extension>.localhost` origin at the runtime port; clipboard reads and requests from other embedded frames remain denied;
- applies a restrictive content security policy that frames only the runtime origin and extension webview origins;
- validates the expected WebContents, main frame, and exact renderer origin for every IPC handler.

The lifecycle and workbench renderers use the same hardened web preferences and memory-only session. The lifecycle renderer allows navigation only to its bundled document. Both owned WebContents are checked for IPC; the state-change subscription exposes the state payload without the Electron event object. The quit dialog uses the `@pstdio/ui` dialog recipe and an alert-dialog role, focuses the safe action first, supports keyboard-only choice, and uses the shared destructive button variant for cancellation. Startup and closing progress indicators are omitted when the operating system requests reduced motion.

## Performance monitoring

Developer tools adds one device-local switch, **Enable performance monitoring**. It is off by default. Electron main saves it as `{ "enabled": boolean }` in `performance-monitoring.json` under its user data, next to the other host-state files. The runtime database never stores it, so a remote runtime cannot turn it on for this device. Browser dashboards save their own switch in `localStorage`. See the [Developer tools guide](../../guides/0003-developer-tools.md) for the person-facing behavior.

Measurement has one owner per process:

- Electron main owns process sampling. `DesktopPerformanceMonitor` (`clients/desktop/src/performance/`) calls `app.getAppMetrics()` every 2 seconds, keeps 15 CPU samples per live process for a 30-second warning window, and drops history for exited processes. Electron divides each process's CPU by the number of logical CPUs; the monitor multiplies it back, so one busy core reads about 100%. Memory stays in kibibytes as Electron reports it.
- Main attributes renderer processes by walking the attached frames of the windows it owns. A process that hosts the workbench or startup main frame takes that role. Other renderers list the extension webviews they host, parsed with the shared `pstdio-api-contracts/extension-webview-path` grammar. Main accepts frames on the exact runtime origin and on `ext-*.localhost` webview hosts at the runtime port. Only the installed extension and webview IDs leave main; the URL and its capability do not. Main does not verify the capability, and a webview can navigate its own frame to an error page under another extension's path, so the names describe hosted frames, not proven owners. A sample that fails because a frame was disposed during a reload is skipped.
- Each installed extension's webviews run on their own origin (see [ADR 0053](../../adrs/0053-per-extension-webview-origins.md)). Chromium therefore runs each extension with an open view in its own renderer process, separate from the workbench. The packaged performance test checks this. That process's CPU and memory belong to that extension alone. If Chromium ever places several extensions in one process, the process lists all of them and its CPU is never split or repeated. GPU work for every renderer stays in the shared GPU process.
- The dashboard owns its slow-frame observer. It observes `long-animation-frame` entries, or `longtask` entries when that is all the renderer supports, sanitizes script attribution to file names, and sends at most one report per second. Main validates each report with the bounded `slowFrameReportSchema` and keeps the newest 50 frames.
- The dashboard owns its frame counter and the list of paused extensions. The counter counts `requestAnimationFrame` callbacks in 1-second buckets, keeps 30 seconds, and stops while the window is hidden. The dashboard sends both values to main with `reportRendererState` when a second completes or a pause changes. Main validates each report with the bounded `rendererStateReportSchema` and keeps only the latest one. The snapshot returns them as `frameRate` and `pausedExtensionIds`.

Nothing runs while the switch is off: no timer, observer, metrics IPC, or endpoint. Turning it on starts the collector, the slow-frame observer, and the frame counter; turning it off stops all three and clears every kept sample. The monitor applies switch changes one at a time, so an endpoint never opens while the previous one is closing. The dashboard registers the frame-rate meter as a trailing status bar item only while the switch is on. Like every status bar item, it shows only in modes that do not draw their own status bar or hide it. The meter reads a snapshot every 2 seconds while it is mounted.

Pausing an extension from the meter's popover unmounts every webview of that extension in the window. With no frame left on its origin, Chromium ends the extension's renderer process. The pause lives only in the dashboard's memory and does not reach the runtime, so the extension's commands, hooks, and schedules keep running.

The preload adds five sender-checked capabilities: `getPerformanceMonitoring`, `setPerformanceMonitoring(boolean)`, `getPerformanceSnapshot`, `reportSlowFrames(report)`, and `reportRendererState(report)`. The snapshot type lives in `pstdio-api-contracts/performance-diagnostics`.

People and agents read the same snapshot. While monitoring is on, main listens on an OS-assigned port bound only to 127.0.0.1. It creates a fresh 256-bit credential in `PSTDIO_HOME/performance/endpoint.json`. The containing directory grants access only to the current user: mode 0700 on Unix and an explicit current-user ACL on Windows. The file is created only after securing that directory. Each request must present the credential before the server reads a snapshot; request size and connection time are bounded. Closing the endpoint destroys connections and removes the descriptor. `pst performance` reads it without starting or calling a runtime, so local process data never reaches a remote server. The command prints only a version-1 desktop snapshot. An active endpoint cannot be replaced by another app; reopening after a crash replaces its stale descriptor and rotates the credential. Opening the endpoint does not delay runtime startup; if it fails, main logs `desktop.performance.endpoint.failed` and the meter keeps working.

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

Release targets are Apple Silicon macOS arm64, Intel macOS x64, Linux x64, and
Windows x64. Forge produces ZIP and DMG artifacts on macOS, ZIP and DEB artifacts
on Linux, and a signed Squirrel Setup installer and update package on Windows.
The DMG opens a Finder window with a static background,
`assets/dmg-background.png` and its `@2x` Retina copy. Both are exported from
the `Desktop · macOS installer · Background` frame in
`design/prompt-studio-website.pen`. Forge places the real app icon and the
Applications link in the clear areas on each side of the painted arrow. Finder
owns the copy, its progress, and replace prompts. No Prompt Studio code runs
while Finder copies the app, so the window cannot report that the copy finished.
Windows signs through Azure Artifact Signing with GitHub OIDC and the Public
Trust profile. The final signed sidecar checksum is recorded before Squirrel
creates its update package. The package enables ASAR integrity and an
explicit full Electron fuse policy that disables Node execution, Node options,
CLI inspection, and privileged `file://` behavior.

## Native releases and updates

Desktop artifacts ship on the matching `pstdio@<version>` GitHub release. The
private desktop package belongs to the same Changesets fixed version group as
`pstdio`, so Changesets versions both together. Native release preparation rejects any drift between
the Electron application, compiled sidecar, installer, sidecar manifest, and
update metadata.

`.github/workflows/release-desktop.yml` runs this native matrix:

| Target | Native output | Release verification | Update path |
| --- | --- | --- | --- |
| macOS arm64 | DMG and ZIP | Developer ID signature, notarization staple, Gatekeeper, clean-home launch | Electron updater through release-owned JSON metadata |
| macOS x64 | DMG and ZIP | Developer ID signature, notarization staple, Gatekeeper, essential packaged tests | Electron updater through release-owned JSON metadata |
| Linux x64 | DEB and portable ZIP | DEB inspection and clean-home launch | Distribution package manager or GitHub release page |
| Windows x64 | Setup EXE, full nupkg, and RELEASES | Trusted Authenticode signatures and timestamps on app, sidecar, installer, and update payload; clean-home launch | Electron Squirrel updater through release-owned RELEASES metadata |

Every target audits the packaged Electron fuse wire and emits a target manifest
plus SHA-256 checksums. The publish job requires the complete four-target set,
revalidates every checksum and component version, uploads the artifacts to the
existing draft release, and only then publishes it. Native jobs receive read-only
repository access; only the final publisher receives `contents: write`.

If macOS notarization returns HTTP 403 with "A required agreement is missing or
has expired", the Apple Developer Account Holder must review pending agreements
in the [developer account](https://developer.apple.com/account). Apple requires
the Account Holder to accept updated developer agreements on behalf of the
organization; see [Apple account roles](https://developer.apple.com/help/account/access/roles).
After the required agreement is in effect, rerun the desktop release workflow.
Keep notarization and the complete four-target publish check enabled.

The workflow checks out `inputs.tag`. If a source or test fix is also needed,
release a version whose tag contains that fix. Rerunning an older tag uses its
original files, even after the fix is merged into `main`.

The native updater is configured in packaged macOS and Windows apps. It resolves
the newest complete `pstdio@<version>` release and points Electron at that
release's update metadata. This avoids depending on services that require plain
SemVer Git tags, which do not match the monorepo tag format. Source builds and
Linux open the release page instead. Windows uses the release download directory
as its Squirrel feed, including the `pstdio@<version>` tag. Release assets keep explicit
platform and architecture names.

## Development and tests

Run the real desktop development flow from the repository root:

```bash
bun run dev:desktop
```

This builds the Electron client, starts the Docker-isolated unified runtime, seeds its project, and attaches Electron to that authenticated external runtime. Its home is repository-local under `__test-tmp__/dev-isolated/pstdio-desktop/`; it never defaults to `~/.pstdio`. Closing Electron detaches from the externally owned runtime and tears down the Compose project and its isolated state.

Cold dependency installation and compilation can take longer than 90 seconds. The host waits while that setup container runs. After setup starts the API process, the container allows 90 seconds for API health and the desktop descriptor, aborts stalled health requests, and exits on failure. The host then reports the container logs instead of waiting indefinitely for a failed runtime.

Use `bun run dev:isolated` for the browser-oriented Docker flow. Only `dev:desktop` starts Electron.

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

Both desktop Playwright suites allow 60 seconds per test on Windows and 30 seconds on other platforms. The user approved the Windows limit on 2026-09-26 after packaged tests took 20 to 24 seconds and first project creation varied from 8 to 18 seconds while cloning and installing default extensions. This changes the whole-test deadline; the measured startup and recovery limits below still apply.

The source Electron suite starts isolated temporary homes and a real Electron process. It checks authenticated attachment, the sandboxed/frozen preload boundary, ephemeral cookie storage, denied popups and permissions, single-instance focus, persistent-runtime detach, and actionable recovery. It also relaunches with a saved dark theme on a light system, and checks that each quit confirmation reaches the visible workbench, including after the workbench renderer crashes and while the workbench is still loading. It also checks the native fallback when the person quits again during confirmation. The packaged suite also measures renderer performance budgets; see [Tests](../../guides/development/0002-testing.md#desktop-performance-budgets). It launches the produced application itself over the Chromium debugging protocol without enabling Electron's disabled Node inspector. It measures the cold-start, warm-attach, and crash-recovery budgets; creates and lists a project through the HttpOnly browser session and descriptor-bearer CLI; promotes ownership without restarting the runtime; proves persistent detach plus project, workbench-state, and theme restoration; opens the quit dialog over a workbench with a running terminal; exercises intentional `pst close`; and retries an unexpected sidecar exit without relaunching Electron.

Packaged startup recovery tests start a real persistent runtime through its bundled CLI. On macOS and Linux, suspending that process proves the startup deadline reaches an actionable recovery view and preserves its descriptor. Resuming it and pressing Retry through the keyboard attaches the same runtime in the same window. A separate test repairs a mismatched instance ID after ownership recovery, then verifies attachment to the original owner. Both flows stop the runtime through `pst close` and remove their isolated homes.

Database recovery tests use temporary homes. They verify that a competing database owner remains healthy and that desktop retries after it stops. They also damage an isolated database control file, verify that recovery preserves it, and restore its original contents before retrying. These tests use the packaged CLI and never open the database directly.

Detached-work tests install a small command-only fixture from `packages/workbench-fixture/fixtures/detached-work`. Its only dependency is the public SDK. Installation runs normally in each isolated home, and the tests verify that its process continues after either desktop quit or API shutdown.

Workbench startup and recovery measurements sample element visibility on animation frames and return the timestamp from the renderer. Startup-window timing uses the later of the native window's first `show` event and the lifecycle document's first contentful paint. The native event also verifies that the window is visible. The controller shows the prerendered startup document at DOM readiness, before remaining resources finish loading or the workbench view is created, so a fast attachment cannot cover the startup renderer while the window is still hidden. Runtime discovery and sidecar verification start after the lifecycle page loads, so checksum reads and process startup do not compete with the initial window display. Both timings are measured from process launch, including time before the debugger attaches. Assertion polling, protocol replies, and trace snapshots must not add time after the UI is visible. The limits are 8 seconds for cold startup, 3 seconds for warm attach, and 500 milliseconds for crash recovery. The startup window must appear in less than 1.5 seconds on Apple Silicon macOS and less than 1 second on Linux and Windows, on both cold launches and warm attachment. Hosted Intel macOS runners start the app two to three times slower, so Intel allows 20 seconds for cold startup and 10 seconds for the startup window. The Intel startup window includes macOS's first-launch check of the freshly signed app, which has taken up to 9 seconds on hosted runners. Intel CI disables hosted-runner indexing before dependency installation; [ADR 0032](../../adrs/0032-temporary-macos-ci-indexing.md) records the measured contention and temporary isolation.

Native runners are slow and costly, so native desktop tests run only in
`.github/workflows/release-desktop.yml`, before a release is published. Pull
requests do not build native desktop apps; run the local commands above to test a
desktop change before merging. The release workflow runs both Electron suites on
Linux and Apple Silicon. Intel macOS runs only the packaged tests tagged
`@essential`: cold startup with both transport paths, and project tabs with pages
and terminals. The workflow configures the SUID sandbox for the source and packaged
executables, verifies the packaged fuse policy, and uploads readiness results
and browser traces. Trace export removes runtime cookies and bearer
credentials from every text entry before artifacts are uploaded.

Release builds use the requested package tag. The Electron specs and their helpers
come from the workflow revision, so a manual run can correct a release check for
an existing draft without changing its tagged application. Windows signing trusts
the `main` branch's GitHub identity. Merge corrected checks before retrying a draft,
then run `Release Desktop` on `main`, set `version` to the
existing version, and set `tag` to its `pstdio@<version>` tag. The final job publishes
the draft only after every native target passes all checks.

The secured compiled-runtime browser suite runs Chromium, Firefox, and WebKit.
`bun run --cwd packages/e2e test:packaged` runs the compiled CLI checks with Bun and the browser checks with the Playwright runner.
It proves extension-origin iframe command and project-setting persistence across reloads.
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
distribution and updates](../../requirements/platform/0002-desktop-distribution.md) for credential
names, verification commands, and operator recovery.
