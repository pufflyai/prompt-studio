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
import { expectPackagedNativeActions, writeNativeActionsExtension } from "./packaged-native-actions-smoke";
import { expectPackagedNativeMarkdown, writeNativeMarkdownExtension } from "./packaged-native-markdown-smoke";
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

test(
  "serves the compiled dashboard at root and project routes with its bundled script",
  async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-dashboard-assets-"));
    let child: ChildProcess | undefined;
    try {
      const started = await startPackagedServe(tempRoot);
      child = started.child;
      for (const path of ["/", "/projects/dashboard-smoke/"]) {
        const response = await fetch(`${started.baseUrl}${path}`);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
        const html = await response.text();
        expect(html).toContain('id="root"');
        const script = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
        expect(script).toBeDefined();
        const bundled = await fetch(new URL(script!, started.baseUrl));
        expect(bundled.status).toBe(200);
        expect(bundled.headers.get("content-type")).toContain("application/javascript");
        expect((await bundled.text()).length).toBeGreaterThan(0);
      }
    } finally {
      if (child) await stopProcess(child);
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);

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
