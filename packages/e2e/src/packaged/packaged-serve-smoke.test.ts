import { beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
import { writeExtensionInstallEnvironmentProbe, writeExtensionWithDependency } from "./extension-fixtures";
import { expectPackagedArtifacts } from "./packaged-artifacts-smoke";
import { registerCoreDefaultExtensionSmokeTests } from "./packaged-core-extensions-smoke";
import { expectExamplePages } from "./packaged-example-metadata";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { registerRemoteExecutionSmokeTests } from "./packaged-remote-execution-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const BUILD_TIMEOUT = 180_000;
const SMOKE_TEST_TIMEOUT = 30_000;

beforeAll(() => {
  if (!process.env.PSTDIO_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

test("checks the repo scope and reports bundled versions despite an invalid user extension", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "packaged-extension-check-")));
  try {
    expect(spawnSync("git", ["init", "--quiet", root]).status).toBe(0);
    const home = join(root, "user-home");
    const invalidExtension = join(home, "extensions", "invalid");
    mkdirSync(invalidExtension, { recursive: true });
    writeFileSync(join(invalidExtension, "package.json"), "{}");
    const result = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "check", "--scope", "repo", "--json"], {
      cwd: root,
      env: { ...process.env, PSTDIO_HOME: home },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const body = JSON.parse(result.stdout);
    const version = spawnSync(PACKAGED_BINARY_PATH, ["--version"], { encoding: "utf8" }).stdout.trim();
    expect(body.versions).toMatchObject({
      cli: version,
      dashboard: version,
      sdk: expect.any(String),
      extensionApi: expect.any(String),
    });
    expect(body.checks).toHaveLength(1);
    expect(body.checks[0]).toMatchObject({
      errorCount: 0,
      extensionsRoot: join(root, ".pstdio", "extensions"),
      hostCompatibility: { status: "verified", host: { hostVersion: version } },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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
          PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture", "extension-lab", "pstdio-artifacts"),
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
        await expectPackagedArtifacts({
          baseUrl: started.baseUrl,
          projectId: project.id,
          headers: runtimeAuthorization(started.descriptor),
          metadata,
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
});

registerCoreDefaultExtensionSmokeTests();
registerRemoteExecutionSmokeTests();

test("packaged CLI includes automation and machine authentication", () => {
  const result = spawnSync(PACKAGED_BINARY_PATH, ["--help"], { encoding: "utf8" });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("pstdio automation [command]");
  expect(result.stdout).toContain("pstdio auth [command]");
});
