import { beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
import { writeExtensionInstallEnvironmentProbe, writeExtensionWithDependency } from "./extension-fixtures";
import { registerCoreDefaultExtensionSmokeTests } from "./packaged-core-extensions-smoke";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const BUILD_TIMEOUT = 180_000;
const SMOKE_TEST_TIMEOUT = 30_000;

beforeAll(() => {
  if (!process.env.PSTDIO_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

const expectExamplePages = (metadata: WorkbenchExtensionMetadata) => {
  for (const [mode, view] of [
    ["boombox", "boombox-player"],
    ["kiln", "kiln-timeline"],
  ]) {
    expect(metadata.placements).toContainEqual(
      expect.objectContaining({
        mode: { extensionId: "pstdio.extension-lab", kind: "mode", id: mode },
        item: {
          kind: "view",
          view: { extensionId: "pstdio.extension-lab", kind: "view", id: view },
          presence: "fixed",
        },
      }),
    );
  }
  for (const name of ["scribble", "boombox", "zipline", "pigeon", "kiln"]) {
    expect(metadata.modes).toContainEqual(
      expect.objectContaining({
        localId: name,
        defaultTheme: { extensionId: "pstdio.extension-lab", kind: "theme", id: name },
      }),
    );
    expect(metadata.themes).toContainEqual(expect.objectContaining({ localId: name }));
    expect(metadata.pages).toContainEqual(
      expect.objectContaining({
        extensionId: "pstdio.extension-lab",
        localId: name,
        slots: [expect.objectContaining({ role: "primary", view: expect.any(Object) })],
      }),
    );
    expect(metadata.pages).toContainEqual(
      expect.objectContaining({
        extensionId: "pstdio.extension-lab",
        localId: `${name}-resource`,
        parent: { extensionId: "pstdio.extension-lab", kind: "page", id: name },
        slots: expect.arrayContaining([expect.objectContaining({ role: "primary", binding: expect.any(Object) })]),
      }),
    );
  }
};

describe("packaged pstdio — self-hosted serve", () => {
  test("includes the extension development and update commands", () => {
    const devResult = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "dev", "--help"], { encoding: "utf8" });
    const updateResult = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "update", "--help"], { encoding: "utf8" });

    expect(devResult.status).toBe(0);
    expect(devResult.stdout).toContain("extensions dev <source>");
    expect(updateResult.status).toBe(0);
    expect(updateResult.stdout).toContain("extensions update [name]");
  });

  test(
    "serves the dashboard and API from the same origin",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot);
        child = started.child;

        const dashboardRes = await fetch(started.baseUrl);
        expect(dashboardRes.status).toBe(200);
        expect(dashboardRes.headers.get("content-type")).toContain("text/html");

        const projectsRes = await fetch(`${started.baseUrl}/v1/projects`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(projectsRes.status).toBe(200);
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
    "creates project without internal catalog seeds and with repo bootstrap artifacts",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot);
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-serve-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
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
            installName: "pstdio-planner",
            origin: {
              kind: "git",
              path: "extensions/pstdio-planner",
              ref: "{hostRelease}",
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

        const repoPath = join(tempRoot, "repo");
        mkdirSync(repoPath, { recursive: true });

        const repoRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/repos`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "repo", path: repoPath }),
        });
        expect(repoRes.status).toBe(201);

        expect(existsSync(join(repoPath, ".pstdio", "config.json"))).toBe(true);
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
        const extensionSource = writeExtensionWithDependency(tempRoot);
        const installEnvironmentProbe = writeExtensionInstallEnvironmentProbe(tempRoot);
        const started = await startPackagedServe(tempRoot, {
          PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
            { source: extensionSource, installName: "dep-ext", skipInstall: true },
            { source: installEnvironmentProbe, installName: "install-env-probe" },
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
          body: JSON.stringify({ name: "packaged-extension-project" }),
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

        expect(JSON.parse(readFileSync(join(tempRoot, "install-env.json"), "utf8"))).toEqual({
          httpsProxy: "http://127.0.0.1:9",
          npmRegistry: "http://127.0.0.1:9",
          npmToken: "registry-secret",
          sourceControlToken: null,
          providerKey: null,
        });
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
          PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture", "extension-lab"),
        });
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-workspace-action-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(metadataRes.status).toBe(200);

        const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
        expectExamplePages(metadata);
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
});

registerCoreDefaultExtensionSmokeTests();

test("packaged CLI includes automation and machine authentication", () => {
  const result = spawnSync(PACKAGED_BINARY_PATH, ["--help"], { encoding: "utf8" });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("pstdio automation [command]");
  expect(result.stdout).toContain("pstdio auth [command]");
});
