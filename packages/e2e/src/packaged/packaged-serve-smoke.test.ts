import { beforeAll, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { writeExtensionInstallEnvironmentProbe, writeExtensionWithDependency } from "./extension-fixtures";
import { registerAccountSmokeTests } from "./packaged-account-smoke";
import { registerAssetStorageSmokeTests } from "./packaged-assets-smoke";
// Includes retained creation drafts, backdrop protection, and creation without row activation.
import { registerBoardPanningSmokeTests } from "./packaged-board-panning-smoke";
// Includes native Workspaces, flat And/Or filters, CLI edits, sync defaults and a runtime restart.
import { registerBoardViewsSmokeTests } from "./packaged-board-views-smoke";
// Localized parameter guidance is readable in compiled CLI help.
import { registerCliHelpSmokeTests } from "./packaged-cli-help-smoke";
// Shared borderless Kanban and data table tabs persist pointer/keyboard order and follow live sync.
import { registerCollectionViewOrderSmokeTests } from "./packaged-collection-view-order-smoke";
// OpenAPI publishes recursive command causes without expanding forever.
// Canonical and deprecated streams preserve full rejections through the SDK and compiled CLI.
import { registerCommandStreamSmokeTests } from "./packaged-command-stream-smoke";
// Shared source checks retain transitive edits and reloads across concurrent projects.
import { registerConcurrentExtensionSmokeTests } from "./packaged-concurrent-extension-smoke";
// Independent hosts also bind one workbench identity to their own environment and folder.
import { registerConcurrentHostsSmokeTests } from "./packaged-concurrent-hosts-smoke";
import { registerConnectionStatusSmokeTests } from "./packaged-connection-status-smoke";
// Core extension checks cover extension-owned draft storage, versioned template edits, and allocated file roots.
// Theme assets carry app colors through the packaged appearance endpoint without UI runtime dependencies.
// Core extension checks cover Notes ownership, Planner archive filters and commands,
// grouped ticket settings and icons, cleanup/merge settings, saved document links, and ticket/workspace navigation.
import { registerCoreDefaultExtensionSmokeTests } from "./packaged-core-extensions-smoke";
import { registerExtensionAutomationSmokeTests } from "./packaged-extension-automation-smoke";
// Includes linked dependency loading and missing dependency diagnostics.
import { registerExtensionDiagnosticsSmokeTests } from "./packaged-extension-diagnostics-smoke";
import { registerExtensionInstallSmokeTests } from "./packaged-extension-install-smoke";
import { registerExtensionStartupSmokeTests } from "./packaged-extension-startup-smoke";
import { registerExtensionViewsSmokeTests } from "./packaged-extension-views-smoke";
// Grouped storage checks cached record/legacy reads after unrelated saves and durable restart.
import { registerGroupedStorageSmokeTests } from "./packaged-grouped-storage-smoke";
// Also checks draft and saved native command discovery, first-action dispatch, and cleanup after project deletion.
// Includes command presentation, native plan confirmations and command-owned parameter schemas through the packaged host.
import { registerHarnessCleanupSmokeTests } from "./packaged-harness-cleanup-smoke";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
// Harness discovery/models live in harness-npm-detection.test.ts; Codex exit outcomes in codex-transport.test.ts.
// Covers compiled webview publication and persistent bundle reuse across runtime restarts.
import { registerLinkedWebviewSmokeTests } from "./packaged-linked-webview-smoke";
// Async question parts and accepted answers survive the packaged live reply path.
import { registerLiveQuestionSmokeTests } from "./packaged-live-question-smoke";
// Native actions cover complete Kanban moves and independent schema dependencies.
// Native actions retain failed outcomes for the UI entry point to report.
// Includes boolean board/table rules with a stored false value.
// Also checks native harness controls and their structured values in packaged command handlers.
// Allocated files stay isolated for two publishers with the same package name.
import { expectPackagedNativeActions, writeNativeActionsExtension } from "./packaged-native-actions-smoke";
// Shared record contracts remain covered through the compiled host. The separate relay
// image checks authenticated HTTP, immutable asset ranges and finite native sockets.
// Private service diagnostics are checked in the manager image smoke with an owned capture endpoint.
// Native relay coverage hydrates artifact mounts and attachment URLs, and restores foreign journal work after restart.
import { registerNativeRelaySmokeTests } from "./packaged-native-relay-smoke";
// Navigation metadata preserves independent panel capabilities through the compiled host.
import { expectPackagedNavigation, writeNavigationExtension } from "./packaged-navigation-smoke";
import { registerNotificationStatusSmokeTests } from "./packaged-notification-status-smoke";
// The browser suite checks typed host props, page updates, structured capability errors and saved settings.
// Real React Query subscriptions cover matching events, reconnect deduplication and unmount cleanup.
// Typed settings deletion restores its fallback after reload.
import { registerPageParamsSmokeTests } from "./packaged-page-params-smoke";
// The packaged browser suite checks document/section Main closure, reload and foreign-document close/pin controls.
// Planner covers timeline state, complete board moves, missing folders/Git metadata, dependency recovery and Git conflicts.
// Its browser smoke also checks immediate ticket property edits while persistence is held open.
import { registerPackagedPlannerSmokeTests } from "./packaged-planner-smoke";
import { registerPackagedProjectSetupSmokeTests } from "./packaged-project-setup-smoke";
// Chat setup checks retained chunks, bounded responses, continuous sticky context and cached reopening.
// Composer coverage preserves route-group file paths and keeps web references natively clickable in packaged messages.
// Queue drag targets follow live-input support and retain padded delete actions.
import { registerQueuedRequestSmokeTests } from "./packaged-queued-requests-smoke";
// Queued request browser checks also cover pending submissions and failed-send draft recovery.
import { registerRemoteExecutionSmokeTests } from "./packaged-remote-execution-smoke";
import { registerResourceChoicesSmokeTests } from "./packaged-resource-choices-smoke";
// Resource links include owner batch-resolution and related-opening commands with public workbench metadata.
// Includes resource path prefixes, owner resolver commands, and resolution through HTTP.
import { registerResourceLinksSmokeTests } from "./packaged-resource-links-smoke";
import { registerResourcePageSmokeTests } from "./packaged-resource-pages-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { registerSessionLaunchSmokeTests } from "./packaged-session-launch-smoke";
import { registerSessionQuerySmokeTests } from "./packaged-session-query-smoke";
// The fixed 1,000-session / 1,000-ticket compiled navigation gate lives in ../perf/subnav-benchmark.ts.
// Packaged browser coverage also checks shared Session action groups and lazy title search in the tab menu.
// Includes cancellation and graceful shutdown after follow-ups steer existing native goal turns.
import { registerSharedCodexSmokeTests } from "./packaged-shared-codex-smoke";
import { registerPackagedShowcaseSmokeTests } from "./packaged-showcase-smoke";
import { registerStorageMigrationSmokeTests } from "./packaged-storage-migration-smoke";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
// Includes the declared clipboard permission on the packaged webview fixture.
// The paired browser smoke also keeps one mount during repeated and overlapping guest initialization.
// Guest pointer presses and clicks reach the host once, and dismiss tab menus across the sandbox boundary.
// The paired browser smoke retains live views, drops tabs onto webviews, and shows fixed tabs beside menu openers.
// Its native Notes editor persists Select All heading changes across preserved blank lines and reload.
// A context-menu deletion resolves its hidden note identifier without opening a parameter form.
// packaged-statistics-loading.spec.ts keeps row activation during delayed statistics loading.
// It also checks extension names, assigned palette shortcuts, idle labels, and persisted Sidenav groups.
// The paired session-menu browser check restores focus to its tab after Escape.
// Its floating launcher hides while open, returns on close, and reopens with the keyboard.
// It also opens a workspace's related session through the default-on preview policy and checks that it is unpinned.
// Related openings preserve selected tabs; all new automatic previews close on page leave and empty panels collapse.
// Manually opened Bottom panels and terminals stay visible across page navigation, retaining the terminal process.
// A terminal opened on a resource page can move into Main on its listing without losing visibility or shell state.
// A page moved into Side/Bottom stays across page navigation and reload; moving it into Main scopes it to that page.
// Related tabs select when revealing closed Side/Bottom panels; open panels keep their selection.
// Related tabs are placed even when a remembered closure hides their panel; global tab selection remains stable.
// Only automatically revealed panels close on leave; pinning or adding a manual tab keeps the panel open.
// Closing manual Bottom elsewhere stays closed on Workspace return, without creating a terminal automatically.
// Dropping a session preview pins it and keeps the destination terminal preview open and leftmost.
// Unpinning a created session replaces the tray preview and keeps it leftmost.
// Adding Terminal in Side or Session in Bottom keeps the other empty panel open.

import { registerWorkspaceCapabilitiesSmokeTests } from "./packaged-workspace-capabilities-smoke";
import { registerWorkspaceCleanupSmokeTests } from "./packaged-workspace-cleanup-smoke";

const BUILD_TIMEOUT = 180_000;

beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

registerSharedCodexSmokeTests();
registerWorkspaceCleanupSmokeTests();
registerCliHelpSmokeTests();
// Replaces an extension with old dependencies and verifies completed staging cleanup.
registerExtensionInstallSmokeTests();
registerExtensionStartupSmokeTests();
registerConcurrentExtensionSmokeTests();
registerExtensionViewsSmokeTests();
registerCollectionViewOrderSmokeTests();
registerConnectionStatusSmokeTests();
registerAssetStorageSmokeTests();
registerGroupedStorageSmokeTests();
registerNativeRelaySmokeTests();
registerAccountSmokeTests();
registerNotificationStatusSmokeTests();

// extension-browser-install.test.ts installs the cached Playwright package and visits a smoke page.

test("includes extension development, smoke test, browser setup and update commands", () => {
  const installBrowser = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "install-browser", "--help"], {
    encoding: "utf8",
  });
  expect(installBrowser.status).toBe(0);
  expect(installBrowser.stdout).toContain("extensions install-browser");
  const testResult = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "test", "--help"], { encoding: "utf8" });
  expect(testResult.status).toBe(0);
  const devResult = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "dev", "--help"], { encoding: "utf8" });
  const updateResult = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "update", "--help"], { encoding: "utf8" });

  expect(devResult.status).toBe(0);
  expect(devResult.stdout).toContain("extensions dev <source>");
  expect(updateResult.status).toBe(0);
  expect(updateResult.stdout).toContain("extensions update [name]");
});

// Includes host drive discovery and browsing through the packaged filesystem API.
registerPackagedProjectSetupSmokeTests();
registerSessionLaunchSmokeTests();

test(
  "loads default extension dependencies, native actions and command-backed workspace choices",
  async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
    let child: ChildProcess | null = null;

    try {
      const extensionSource = writeExtensionWithDependency(tempRoot, `^0.0.9 || ^${EXTENSION_API_VERSION}`);
      const installEnvironmentProbe = writeExtensionInstallEnvironmentProbe(tempRoot);
      const navigationProbe = writeNavigationExtension(tempRoot);
      const nativeActions = writeNativeActionsExtension(tempRoot);
      const otherNativeActions = writeNativeActionsExtension(join(tempRoot, "other-source"), "other");
      const started = await startPackagedServe(tempRoot, {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
          { source: extensionSource, installName: "dep-ext", skipInstall: true },
          { source: installEnvironmentProbe, installName: "install-env-probe" },
          { source: navigationProbe, installName: "navigation-probe" },
          { source: nativeActions, installName: "native-actions" },
          { source: otherNativeActions, installName: "other-native-actions" },
        ]),
        HTTPS_PROXY: "http://127.0.0.1:9",
        NPM_CONFIG_REGISTRY: "http://127.0.0.1:9",
        NPM_TOKEN: "registry-secret",
        GITHUB_TOKEN: "source-control-secret",
        OPENAI_API_KEY: "provider-secret",
      });
      child = started.child;

      const projectFolder = join(tempRoot, "project");
      mkdirSync(projectFolder, { recursive: true });
      const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "packaged-extension-project" }, projectFolder)),
      });
      expect(createRes.status).toBe(201);

      const project = (await createRes.json()) as { id: string };
      const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(extensionsRes.status).toBe(200);

      const body = (await extensionsRes.json()) as {
        extensions: Array<{ enabled: boolean; installName: string; name: string }>;
      };
      const extension = body.extensions.find((entry) => entry.installName === "dep-ext");

      expect(extension).toMatchObject({
        enabled: true,
        name: "dep-ext",
      });
      await expectPackagedNativeActions({
        projectFolder,
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
      });
      await expectPackagedNavigation({
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
      });

      // Even trusted dependency scripts must not run during an extension install.
      expect(existsSync(join(tempRoot, "install-env.json"))).toBe(false);
    } finally {
      if (child) {
        await stopProcess(child);
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);

// Browser smoke also covers mode panel restoration, extension-mode session reload, and generic page-preview cleanup.
// Showcase resource checks include resolving an unknown Artifact without a failed command.
registerPackagedShowcaseSmokeTests();
registerPackagedPlannerSmokeTests();

registerCoreDefaultExtensionSmokeTests();
registerExtensionDiagnosticsSmokeTests();
registerLinkedWebviewSmokeTests();
registerRemoteExecutionSmokeTests();
registerConcurrentHostsSmokeTests();

test("packaged CLI includes automation and machine authentication", () => {
  const result = spawnSync(PACKAGED_BINARY_PATH, ["--help"], { encoding: "utf8" });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("pstdio automation [command]");
  expect(result.stdout).toContain("pstdio auth [command]");

  // Reads only this device's desktop app, so an empty home starts no runtime.
  const home = mkdtempSync(join(tmpdir(), "packaged-performance-"));
  const performance = spawnSync(PACKAGED_BINARY_PATH, ["performance"], {
    encoding: "utf8",
    env: { ...process.env, PSTDIO_HOME: home },
  });
  expect(performance.status).not.toBe(0);
  expect(performance.stdout).toBe("");
  expect(existsSync(join(home, "runtime.json"))).toBe(false);
  rmSync(home, { recursive: true, force: true });
});

registerExtensionAutomationSmokeTests();
registerHarnessCleanupSmokeTests();
registerLiveQuestionSmokeTests();

// Shared views persist flat filters and one ordering, and reject a second sort.
registerBoardViewsSmokeTests();
registerBoardPanningSmokeTests();

registerResourceLinksSmokeTests();

registerCommandStreamSmokeTests();
registerResourceChoicesSmokeTests();
// Includes edit recovery after dispatch with draft, model, parameter, and file ownership checks.
registerQueuedRequestSmokeTests();

registerSessionQuerySmokeTests();
registerStorageMigrationSmokeTests();

registerWorkspaceCapabilitiesSmokeTests();

registerPageParamsSmokeTests();

registerResourcePageSmokeTests();
