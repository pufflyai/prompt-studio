// packaged-page-params-during-mount.p2.test.ts covers host props changed during async guest initialization.
// packaged-session-import.p1.test.ts restores JSONL session exports through the compiled CLI and API, including the on-disk metadata index.
// packaged-extensions-navigation.p1.spec.ts covers fixed headers and nested extension URLs.
// packaged-collection-view-order-smoke.p2.test.ts keeps Save view clickable beneath explanatory tooltips.
// packaged-extension-icons.p1.spec.ts covers public SVG assets and light/dark image colors.
import { beforeAll, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { writeExtensionInstallEnvironmentProbe, writeExtensionWithDependency } from "./extension-fixtures";
import { expectPackagedGitFreeExtensions } from "./packaged-git-free-extensions-smoke";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
// Native actions cover complete Kanban moves, resource lists and independent schema dependencies.
// packaged-native-settings.p2.spec.ts checks the Extensions nav page, direct routes, reload, native settings and scrolling.
// packaged-marketplace-search.p1.spec.ts finds downloads by their visible full ID.
// Git-free installation preserves bundled extension IDs, names and icon metadata.
// packaged-extension-settings-smoke.p2.test.ts checks device settings across projects and restarts.
// packaged-independent-extensions-smoke.p2.test.ts checks stable and nightly extension package versions.
// Native actions retain failed outcomes for the UI entry point to report.
// Includes boolean board/table rules with a stored false value.
// Also checks native harness controls and their structured values in packaged command handlers.
// packaged-claude-plan-smoke.p2.test.ts checks Claude plan review through the live question channel.
// packaged-personal-history-smoke.p2.test.ts checks encrypted message-log blobs and complete offline history after restart.
// packaged-tool-result-limit.p2.test.ts bounds a 76 MB failed result, including duplicate details, across restart.
// Packaged harnesses expose scoped account state and a private interactive account channel.
// packaged-session-fork.p1.test.ts checks independent conversation history through the compiled CLI and host.
// harness-npm-detection.p1.test.ts checks the patched Pi minimum with the maintained package's Windows layout.
// Allocated files stay isolated for two publishers with the same package name.
import { expectPackagedNativeActions, writeNativeActionsExtension } from "./packaged-native-actions-smoke";
import { expectPackagedNativeMarkdown, writeNativeMarkdownExtension } from "./packaged-native-markdown-smoke";
// The Markdown fixture resolves/projects a registered source and uses the public SDK session through authenticated agent admission, preserving front matter and one Yjs runtime. Native observations share that client event stream and cancel without stopping the editor.
// packaged-extension-install-smoke.p1.test.ts checks every replacement webview and preserves the working install if one fails.
// packaged-canvas-install.p2.test.ts checks optional Canvas module assets, previews, themes, and skills without local build fingerprints.
// Catalog IDs and extension icons remain available through the compiled host.
// Navigation metadata preserves tabless pages, panel views, slot replacements, caller-relative handoff,
// placeholder actions and status-item popover views through the compiled host.
// scripts/verify/workbench-package-consumer.ts checks packaged activation, scoped status persistence and overlay exports.
// scripts/verify/public-package-consumer.ts checks legacy hidden headers and explicit page/tab presentation in the built workbench.
// It also imports the packed SDK's browser-free theme converter, checks both packed UI contrast palettes, and bundles the charts entry with a Gantt consumer.
// packaged-session-tools.p1.spec.ts checks draft/session/tool tab restoration across navigation and reload, creation, closure and New session tools.
// packaged-empty-panels.p2.spec.ts checks Home startup without tool cards and page-scoped headers through reload and immediate navigation.
// packaged-main-fullscreen.p2.spec.ts checks panel/fullscreen shortcuts and mode completion through the bundled opaque guest runtime.
// packaged-notes-page.p2.spec.ts checks immediate palette creation, Notes creation cards, Add actions, and page-owned Main tabs across navigation and reload.
// packaged-planner-timeline-smoke.ts checks side-panel attention actions without leaving the board or timeline.
// packaged-planner-smoke.p2.test.ts checks manual recovery of missing stopped work with Auto Build disabled.
// packaged-lab-selection.p2.spec.ts checks tabless selection, retained frames, shared edits and saved transforms.
// packaged-scribble-pages.p2.spec.ts checks native Scribble pages, drafts, favorites and group operations.
// performance-observer.p2.test.ts checks native CPU units and memory through the compiled observer's direct startup path.
// packaged-core-extensions-smoke.p1.test.ts checks Onboarding's setup contribution and bundled webview.
// packaged-core-extensions-smoke.p1.test.ts installs Home through packed public SDK/UI packages and checks its landing declaration.
// packaged-core-extensions-smoke.p1.test.ts checks Notes, Planner and Reports allocate record IDs through core.
// packaged-artifact-watch-limit.p2.test.ts checks watched mounts refresh when an initial tree exceeds the folder limit.
// packaged-core-extensions-smoke.p1.test.ts checks Reports reads by core-assigned ID and number after saving.
// packaged-cloud-extension-set-smoke.p2.test.ts checks offline number collisions, aliases and later allocations across three compiled hosts.
// packaged-document-sync-smoke.p1.test.ts checks verified-document progress and pending counts through the compiled host.
// packaged-workspace-cleanup-smoke.p1.test.ts rejects unavailable providers before saving rows and bounds provider deletion concurrency.
// packaged-account-smoke.p2.test.ts checks rejected-device sign-in recovery across restarts and explicit sign-out.
// packaged-document-sync-smoke.p1.test.ts checks encrypted large-save blobs trigger record-stream compaction.
// packaged-two-device-sync-smoke.p2.test.ts opens a recovered cloud project in the picker and restores its managed files.
// packaged-cloud-notes-onboarding.p2.test.ts checks local folder ownership and the actual Notes plus/save/sync flow.
// packaged-board-panning-smoke.p2.test.ts retains card opening and dragging; the UI Card Gestures story covers nested-control pointer ownership.
import { expectPackagedNavigation, writeNavigationExtension } from "./packaged-navigation-smoke";
import { expectPackagedSavedRecordings } from "./packaged-performance-smoke";
import { expectPackagedProjectChoices, writePackagedChoiceSources } from "./packaged-project-setup-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import {
  expectPackagedWorkspacePresentation,
  writeWorkspacePresentationExtension,
} from "./packaged-workspace-presentation-smoke";

const BUILD_TIMEOUT = 180_000;

beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

// extension-browser-install.p1.test.ts installs the cached Playwright package and visits a smoke page.

test(
  "exports saved performance recordings with monitoring stopped",
  expectPackagedSavedRecordings,
  PACKAGED_TEST_TIMEOUT,
);

test("includes extension development, smoke test, browser setup and update commands", () => {
  const fork = spawnSync(PACKAGED_BINARY_PATH, ["sessions", "fork", "--help"], { encoding: "utf8" });
  expect(fork.status).toBe(0);
  expect(fork.stdout).toContain("--id");
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
      const catalogPath = join(tempRoot, "catalog.json");
      writeFileSync(
        catalogPath,
        JSON.stringify({
          version: 1,
          extensions: [
            ...writePackagedChoiceSources(tempRoot),
            {
              installName: "metadata-probe",
              extensionId: "test.metadata-probe",
              displayName: "Metadata probe",
              icon: "Blocks",
              description: "",
              origin: { kind: "git", url: "https://example.com/probe.git", path: "extension", ref: "main" },
              default: false,
            },
            {
              installName: "servicing-only",
              extensionId: "test.servicing-only",
              displayName: "Servicing only",
              description: "",
              listed: false,
              origin: { kind: "git", url: "https://example.com/probe.git", path: "extension", ref: "main" },
              default: false,
            },
          ],
        }),
      );
      const started = await startPackagedServe(tempRoot, {
        PSTDIO_EXTENSION_CATALOG: catalogPath,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
          { source: extensionSource, installName: "dep-ext", skipInstall: true },
          { source: installEnvironmentProbe, installName: "install-env-probe" },
          { source: navigationProbe, installName: "navigation-probe" },
          { source: writeWorkspacePresentationExtension(tempRoot), installName: "workspace-presentation" },
          { source: nativeActions, installName: "native-actions" },
          { source: writeNativeMarkdownExtension(tempRoot), installName: "native-markdown" },
          { source: otherNativeActions, installName: "other-native-actions" },
        ]),
        HTTPS_PROXY: "http://127.0.0.1:9",
        NPM_CONFIG_REGISTRY: "http://127.0.0.1:9",
        NPM_TOKEN: "registry-secret",
        GITHUB_TOKEN: "source-control-secret",
        OPENAI_API_KEY: "provider-secret",
      });
      child = started.child;

      const capacityUrl = `${started.baseUrl}/v1/workspaces/capacity`;
      const capacityHeaders = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
      const initialCapacity = await fetch(capacityUrl, { headers: capacityHeaders });
      expect(initialCapacity.status).toBe(200);
      expect(await initialCapacity.json()).toMatchObject({ activeCount: 0, limit: null });
      for (const limit of [1, null]) {
        const updated = await fetch(capacityUrl, {
          method: "PATCH",
          headers: capacityHeaders,
          body: JSON.stringify({ limit }),
        });
        expect(updated.status).toBe(200);
        expect(await updated.json()).toMatchObject({ activeCount: 0, limit });
      }

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
      await expectPackagedProjectChoices(
        started.baseUrl,
        runtimeAuthorization(started.descriptor),
        project.id,
        peer.id,
        tempRoot,
      );
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
        marketplace: Array<{ extensionId?: string; icon?: string }>;
      };
      expect(body.marketplace).toContainEqual(
        expect.objectContaining({ extensionId: "test.metadata-probe", icon: "Blocks" }),
      );
      expect(body.marketplace).not.toContainEqual(expect.objectContaining({ extensionId: "test.servicing-only" }));
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
      await expectPackagedNativeMarkdown({
        projectFolder,
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
      });
      await expectPackagedWorkspacePresentation({
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
  "installs bundled defaults and recovers existing extensions without Git",
  expectPackagedGitFreeExtensions,
  PACKAGED_TEST_TIMEOUT,
);
