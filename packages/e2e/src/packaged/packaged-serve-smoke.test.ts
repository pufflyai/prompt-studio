import { beforeAll, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { writeExtensionInstallEnvironmentProbe, writeExtensionWithDependency } from "./extension-fixtures";
import { expectPackagedArtifacts } from "./packaged-artifacts-smoke";
// Includes retained creation drafts, backdrop protection, and creation without row activation.
import { registerBoardPanningSmokeTests } from "./packaged-board-panning-smoke";
// Includes native Workspaces, flat And/Or filters, CLI edits, sync defaults and a runtime restart.
import { registerBoardViewsSmokeTests } from "./packaged-board-views-smoke";
// Also checks inline and display equations with the packaged KaTeX assets.
import { expectPackagedChatComposer } from "./packaged-chat-composer-smoke";
import { registerCommandStreamSmokeTests } from "./packaged-command-stream-smoke";
import { registerConcurrentHostsSmokeTests } from "./packaged-concurrent-hosts-smoke";
import { expectPackagedConnectionStatus } from "./packaged-connection-status-smoke";
// Core extension checks cover Notes ownership, Planner archive filters and commands,
// ticket cleanup/merge settings, saved document links, and continuous ticket/workspace navigation.
import { registerCoreDefaultExtensionSmokeTests } from "./packaged-core-extensions-smoke";
import { expectExamplePages } from "./packaged-example-metadata";
import { registerExtensionAutomationSmokeTests } from "./packaged-extension-automation-smoke";
import { registerExtensionDiagnosticsSmokeTests } from "./packaged-extension-diagnostics-smoke";
import { registerExtensionInstallSmokeTests } from "./packaged-extension-install-smoke";
import { registerExtensionViewsSmokeTests } from "./packaged-extension-views-smoke";
import { expectPackagedFolderOwnership } from "./packaged-folder-ownership";
// Also checks draft and saved native command discovery, first-action dispatch, and cleanup.
// Includes command presentation, native plan confirmations and command-owned parameter schemas through the packaged host.
import { registerHarnessCleanupSmokeTests } from "./packaged-harness-cleanup-smoke";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
// npm harness detection and model discovery are covered by harness-npm-detection.test.ts.
// Covers compiled webview publication and persistent bundle reuse across runtime restarts.
import { registerLinkedWebviewSmokeTests } from "./packaged-linked-webview-smoke";
// Async question parts and accepted answers survive the packaged live reply path.
import { registerLiveQuestionSmokeTests } from "./packaged-live-question-smoke";
// Native actions retain failed outcomes for the UI entry point to report.
// Includes boolean board/table rules with a stored false value.
import { expectPackagedNativeActions, writeNativeActionsExtension } from "./packaged-native-actions-smoke";
import { expectPackagedNavigation, writeNavigationExtension } from "./packaged-navigation-smoke";
// Queue drag targets follow live-input support and retain padded delete actions.
import { registerQueuedRequestSmokeTests } from "./packaged-queued-requests-smoke";
import { expectPackagedRefinement } from "./packaged-refinement-smoke";
import { registerRemoteExecutionSmokeTests } from "./packaged-remote-execution-smoke";
// Resource links include owner batch-resolution commands and their public workbench metadata.
import { registerResourceLinksSmokeTests } from "./packaged-resource-links-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
// Includes the declared clipboard permission on the packaged webview fixture.
// The paired browser smoke retains live views, drops tabs onto webviews, and shows fixed tabs beside menu openers.
// It also checks extension names, assigned palette shortcuts, idle labels, and persisted Sidenav groups.
import { expectPackagedWebviewRuntime } from "./packaged-webview-runtime-smoke";

import { expectPackagedWorkspaceFileLink } from "./packaged-workspace-link-smoke";

const BUILD_TIMEOUT = 180_000;
const SMOKE_TEST_TIMEOUT = 30_000;

beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

registerExtensionInstallSmokeTests();
registerExtensionViewsSmokeTests();

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

test(
  "serves the dashboard and API from the same origin and hands off composer drafts immediately",
  async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
    let child: ChildProcess | null = null;

    try {
      const started = await startPackagedServe(tempRoot, {
        PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture"),
      });
      child = started.child;

      const dashboardRes = await fetch(started.baseUrl);
      expect(dashboardRes.status).toBe(200);
      expect(dashboardRes.headers.get("content-type")).toContain("text/html");
      const dashboardHtml = await dashboardRes.text();
      const moduleScript = dashboardHtml.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
      expect(moduleScript).not.toBeNull();
      const dashboardScript = await fetch(new URL(moduleScript![1]!, started.baseUrl));
      expect(dashboardScript.status).toBe(200);
      expect(dashboardScript.headers.get("content-type")).toMatch(/javascript/);

      const projectsRes = await fetch(`${started.baseUrl}/v1/projects`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(projectsRes.status).toBe(200);
      expect(await projectsRes.json()).toEqual([]);
      const renameRes = await fetch(`${started.baseUrl}/v1/sessions/missing/title`, {
        method: "PATCH",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify({ title: " " }),
      });
      expect(renameRes.status).toBe(400);
      await expectPackagedChatComposer(started.baseUrl, runtimeAuthorization(started.descriptor), tempRoot);
      await expectPackagedConnectionStatus(started.baseUrl, runtimeAuthorization(started.descriptor));
    } finally {
      if (child) {
        await stopProcess(child);
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
  SMOKE_TEST_TIMEOUT,
);

test(
  "opens an empty folder with project bootstrap artifacts and preserves it after restart",
  async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
    let child: ChildProcess | null = null;

    try {
      const started = await startPackagedServe(tempRoot);
      child = started.child;

      const repoPath = join(tempRoot, "project-folder");
      mkdirSync(repoPath, { recursive: true });
      const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "packaged-serve-project" }, repoPath)),
      });
      expect(createRes.status).toBe(201);

      const project = (await createRes.json()) as { id: string };
      await expectPackagedWorkspaceFileLink({
        baseUrl: started.baseUrl,
        projectId: project.id,
        projectRoot: repoPath,
        home: tempRoot,
        headers: runtimeAuthorization(started.descriptor),
      });
      const providersRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/workspace-providers`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(providersRes.status).toBe(200);
      expect(await providersRes.json()).toEqual([]);
      const invalidWorkspace = await fetch(`${started.baseUrl}/v1/workspaces`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, provider_id: "pstdio.root", params: { typo: true } }),
      });
      expect(invalidWorkspace.status).toBe(400);
      expect((await invalidWorkspace.json()).error).toContain("typo");
      const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(extensionsRes.status).toBe(200);
      const extensionCatalog = (await extensionsRes.json()) as {
        marketplace: Array<{
          installName: string;
          origin: { kind: "git"; path: string; ref: string; url: string };
          publisher?: string;
        }>;
      };
      expect(extensionCatalog.marketplace).toContainEqual(
        expect.objectContaining({
          installName: "pstdio-artifacts",
          installed: false,
          origin: {
            kind: "git",
            path: "extensions/pstdio-artifacts",
            ref: expect.stringMatching(/^pstdio@\d/),
            url: "https://github.com/pufflyai/prompt-studio",
          },
          publisher: "pstdio",
        }),
      );
      expect(extensionCatalog.marketplace).toContainEqual(
        expect.objectContaining({
          installName: "pstdio-notes",
          origin: {
            kind: "git",
            path: "extensions/pstdio-notes",
            ref: expect.stringMatching(/^pstdio@\d/),
            url: "https://github.com/pufflyai/prompt-studio",
          },
          publisher: "pstdio",
        }),
      );
      expect(extensionCatalog.marketplace).toContainEqual(
        expect.objectContaining({
          installName: "pstdio-planner",
          origin: {
            kind: "git",
            path: "extensions/pstdio-planner",
            ref: expect.stringMatching(/^pstdio@\d/),
            url: "https://github.com/pufflyai/prompt-studio",
          },
          publisher: "pufflyai",
        }),
      );

      const skillsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/skills`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(skillsRes.status).toBe(200);

      const skills = (await skillsRes.json()) as {
        name: string;
        files: { path: string; content: string; encoding: "utf8" }[];
      }[];
      expect(skills).toEqual([]);

      expect(existsSync(join(repoPath, ".pstdio", "config.json"))).toBe(true);

      await stopProcess(child);
      const restarted = await startPackagedServe(tempRoot);
      child = restarted.child;
      const projectsRes = await fetch(`${restarted.baseUrl}/v1/projects`, {
        headers: runtimeAuthorization(restarted.descriptor),
      });
      expect(projectsRes.status).toBe(200);
      expect(await projectsRes.json()).toEqual([
        expect.objectContaining({ id: project.id, name: "packaged-serve-project" }),
      ]);
      await expectPackagedFolderOwnership(restarted.baseUrl, runtimeAuthorization(restarted.descriptor), tempRoot);
      const deleted = await fetch(`${restarted.baseUrl}/v1/projects/${project.id}`, {
        method: "DELETE",
        headers: runtimeAuthorization(restarted.descriptor),
      });
      expect(deleted.status).toBe(204);
      expect(existsSync(repoPath)).toBe(true);
      expect(existsSync(join(repoPath, ".pstdio/config.json"))).toBe(false);
    } finally {
      if (child) {
        await stopProcess(child);
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
  SMOKE_TEST_TIMEOUT,
);

test(
  "loads a default extension that imports an on-disk node_modules dependency",
  async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
    let child: ChildProcess | null = null;

    try {
      const extensionSource = writeExtensionWithDependency(tempRoot, `^0.0.9 || ^${EXTENSION_API_VERSION}`);
      const installEnvironmentProbe = writeExtensionInstallEnvironmentProbe(tempRoot);
      const navigationProbe = writeNavigationExtension(tempRoot);
      const nativeActions = writeNativeActionsExtension(tempRoot);
      const started = await startPackagedServe(tempRoot, {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
          { source: extensionSource, installName: "dep-ext", skipInstall: true },
          { source: installEnvironmentProbe, installName: "install-env-probe" },
          { source: navigationProbe, installName: "navigation-probe" },
          { source: nativeActions, installName: "native-actions" },
        ]),
        HTTPS_PROXY: "http://127.0.0.1:9",
        NPM_CONFIG_REGISTRY: "http://127.0.0.1:9",
        NPM_TOKEN: "registry-secret",
        GITHUB_TOKEN: "source-control-secret",
        OPENAI_API_KEY: "provider-secret",
      });
      child = started.child;

      const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "packaged-extension-project" })),
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
  SMOKE_TEST_TIMEOUT,
);

test(
  "serves workspace actions and complete showcase mode metadata",
  async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
    let child: ChildProcess | null = null;

    try {
      const started = await startPackagedServe(tempRoot, {
        PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(
          "workbench-fixture",
          "extension-lab",
          "pstdio-artifacts",
          "pstdio-planner",
        ),
        // This check exercises metadata and commands; browser suites cover webview builds.
        PSTDIO_EXTENSION_WEBVIEW_BUILDS: "0",
      });
      child = started.child;

      const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "packaged-workspace-action-project" })),
      });
      expect(createRes.status).toBe(201);

      const project = (await createRes.json()) as { id: string };
      const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(metadataRes.status).toBe(200);

      const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
      expectExamplePages(metadata);
      expect(
        metadata.commands.find(
          (command) => command.id === "pstdio.workbench-fixture.command.glass-lab-artifacts.delete",
        )?.resourceMutation,
      ).toEqual({
        kind: "remove",
        resourceType: "glass-lab-artifact",
        idParam: "rowId",
      });
      await expectPackagedWebviewRuntime(started.baseUrl, metadata);
      await expectPackagedArtifacts({
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
        metadata,
      });
      await expectPackagedRefinement({
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
      });
      const counter = await fetch(
        `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/pstdio.workbench-fixture.command.counter.bump/execute`,
        {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ params: {} }),
        },
      );
      expect(counter.status).toBe(200);
      expect(await counter.json()).toMatchObject({
        outcome: { status: "success", value: { counter: 1 } },
        eventIds: expect.arrayContaining(["pstdio.workbench-fixture.event.counter.changed"]),
      });
      const workspaceAction = metadata.menuContributions.find(
        (contribution) => contribution.label === "Workspace-only lab action",
      );
      expect(workspaceAction?.when).toEqual({ resourceType: ["workspace"] });
      expect(metadata.pages).toContainEqual(
        expect.objectContaining({
          extensionId: "pstdio.workbench-fixture",
          localId: "lab",
          path: "lab",
        }),
      );
      expect(metadata.navigationTrees).toContainEqual(
        expect.objectContaining({
          id: "pstdio.workbench-fixture.navigation-tree.lab-cameras",
          owner: expect.objectContaining({ kind: "page", id: "lab" }),
          slot: "content",
          view: expect.objectContaining({ kind: "view", id: "camera-tree" }),
        }),
      );
    } finally {
      if (child) {
        await stopProcess(child);
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
  SMOKE_TEST_TIMEOUT,
);

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
// Includes edit recovery after dispatch with draft, model, parameter, and file ownership checks.
registerQueuedRequestSmokeTests();
