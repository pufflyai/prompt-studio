import { beforeAll, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { writeExtensionInstallEnvironmentProbe, writeExtensionWithDependency } from "./extension-fixtures";
import { expectPackagedGitFreeExtensions } from "./packaged-git-free-extensions-smoke";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
// Native actions cover complete Kanban moves and independent schema dependencies.
// packaged-extension-settings-smoke.p2.test.ts checks device settings across projects and restarts.
// packaged-independent-extensions-smoke.p2.test.ts checks stable and nightly extension package versions.
// Native actions retain failed outcomes for the UI entry point to report.
// Includes boolean board/table rules with a stored false value.
// Also checks native harness controls and their structured values in packaged command handlers.
// packaged-claude-plan-smoke.p2.test.ts checks Claude plan review through the live question channel.
// Packaged harnesses expose scoped account state and a private interactive account channel.
// harness-npm-detection.p2.test.ts checks the patched Pi minimum with the maintained package's Windows layout.
// Allocated files stay isolated for two publishers with the same package name.
import { expectPackagedNativeActions, writeNativeActionsExtension } from "./packaged-native-actions-smoke";
// packaged-extension-install-smoke.p1.test.ts checks every replacement webview and preserves the working install if one fails.
// packaged-canvas-install.p1.test.ts checks optional Canvas module assets, previews, themes, and skills without local build fingerprints.
// Navigation metadata preserves tabless pages, panel views, slot replacements, caller-relative handoff,
// placeholder actions and status-item popover views through the compiled host.
// scripts/verify/public-package-consumer.ts checks legacy hidden headers and explicit page/tab presentation in the built workbench.
// It also imports the packed SDK's browser-free theme converter and checks both packed UI contrast palettes.
// packaged-session-tools.p1.spec.ts checks draft/session/tool tab restoration across navigation and reload, creation, closure and New session tools.
// packaged-empty-panels.p2.spec.ts checks Home startup without tool cards and page-scoped headers through reload and immediate navigation.
// packaged-main-fullscreen.p2.spec.ts checks panel/fullscreen shortcuts and mode completion through the bundled opaque guest runtime.
// packaged-notes-page.p2.spec.ts checks Notes creation cards, Add actions, and page-owned Main tabs across navigation and reload.
// packaged-planner-timeline-smoke.ts checks side-panel attention actions without leaving the board or timeline.
// packaged-lab-selection.p2.spec.ts checks tabless selection, retained frames, shared edits and saved transforms.
// packaged-scribble-pages.p2.spec.ts checks native Scribble pages, drafts, favorites and group operations.
// performance-observer.p2.test.ts checks native CPU units and memory in the compiled observer.
// packaged-core-extensions-smoke.p1.test.ts checks Notes, Planner and Reports allocate record IDs through core.
// packaged-core-extensions-smoke.p1.test.ts checks Reports reads by core-assigned ID and number after saving.
// packaged-cloud-extension-set-smoke.p2.test.ts checks offline number collisions, aliases and later allocations across three compiled hosts.
// packaged-document-sync-smoke.p1.test.ts checks encrypted large-save blobs trigger record-stream compaction.
// packaged-board-panning-smoke.p2.test.ts retains card opening and dragging; the UI Card Gestures story covers nested-control pointer ownership.
import { expectPackagedNavigation, writeNavigationExtension } from "./packaged-navigation-smoke";
import { expectPackagedSavedRecordings } from "./packaged-performance-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const BUILD_TIMEOUT = 180_000;

beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

// extension-browser-install.p2.test.ts installs the cached Playwright package and visits a smoke page.

test(
  "exports saved performance recordings with monitoring stopped",
  expectPackagedSavedRecordings,
  PACKAGED_TEST_TIMEOUT,
);

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

test(
  "loads default extensions for concurrent projects, native actions and command-backed workspace choices",
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
      const peerFolder = join(tempRoot, "peer-project");
      mkdirSync(projectFolder, { recursive: true });
      mkdirSync(peerFolder, { recursive: true });
      const [createRes, peerRes] = await Promise.all(
        [projectFolder, peerFolder].map((folder) =>
          fetch(`${started.baseUrl}/v1/projects`, {
            method: "POST",
            headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
            body: JSON.stringify(folderProjectInput({ name: "packaged-extension-project" }, folder)),
          }),
        ),
      );
      expect(createRes.status).toBe(201);
      expect(peerRes.status).toBe(201);

      const project = (await createRes.json()) as { id: string };
      const peer = (await peerRes.json()) as { id: string };
      const peerExtensions = await fetch(`${started.baseUrl}/v1/projects/${peer.id}/extensions`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(peerExtensions.status).toBe(200);
      expect((await peerExtensions.json()).extensions).toContainEqual(
        expect.objectContaining({ enabled: true, installName: "dep-ext" }),
      );
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

test(
  "installs bundled defaults without Git and does not offer Git workspaces",
  expectPackagedGitFreeExtensions,
  PACKAGED_TEST_TIMEOUT,
);
