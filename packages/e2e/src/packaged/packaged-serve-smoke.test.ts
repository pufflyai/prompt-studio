import { beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { writeExtensionInstallEnvironmentProbe, writeExtensionWithDependency } from "./extension-fixtures";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const BUILD_TIMEOUT = 180_000;
const SMOKE_TEST_TIMEOUT = 30_000;
// The macOS Intel release runner can spend over a minute extracting and loading all bundled core extensions.
const CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT = 120_000;
const REPO_ROOT = join(import.meta.dirname, "../../../..");
const CORE_DEFAULT_EXTENSION_NAMES = [
  "harness-claude-code",
  "harness-codex",
  "harness-open-code",
  "pstdio-base-themes",
  "pstdio-planner",
  "pstdio-reports",
  "pstdio-skills",
];

beforeAll(() => {
  if (!process.env.PSTDIO_PACKAGED_BINARY_PATH) {
    buildBinary();
  }
}, BUILD_TIMEOUT);

describe("packaged pstdio — self-hosted serve", () => {
  test("includes the extension development command", () => {
    const result = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "dev", "--help"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("extensions dev <source>");
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
        const templatesRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/templates`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(templatesRes.status).toBe(200);

        const templates = (await templatesRes.json()) as { name: string }[];
        expect(templates).toEqual([]);

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
});

describe("packaged pstdio — core default extensions", () => {
  test(
    "loads packaged core default extensions",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;
      let closeRegistry: (() => Promise<void>) | null = null;

      try {
        const npmConfigPath = join(tempRoot, ".npmrc");
        const registry = await startLocalWorkspaceRegistry({
          configPath: npmConfigPath,
          outputRoot: tempRoot,
          packagePaths: [join(REPO_ROOT, "packages/sdk"), join(REPO_ROOT, "packages/ui")],
        });
        closeRegistry = registry.close;
        const started = await startPackagedServe(tempRoot, {
          NPM_CONFIG_USERCONFIG: npmConfigPath,
          PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
            defaultExtensions: CORE_DEFAULT_EXTENSION_NAMES.map((installName) => ({
              installName,
              source: join(REPO_ROOT, "extensions", installName),
            })),
          }),
        });
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-core-extensions-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { extension_warnings?: unknown[]; id: string };
        expect(project.extension_warnings).toBeUndefined();
        const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(extensionsRes.status).toBe(200);

        const body = (await extensionsRes.json()) as {
          extensions: Array<{ canUpgrade: boolean; enabled: boolean; installName: string; name: string }>;
        };

        expect(body.extensions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ enabled: true, installName: "harness-claude-code" }),
            expect.objectContaining({ enabled: true, installName: "harness-codex" }),
            expect.objectContaining({ enabled: true, installName: "harness-open-code" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-base-themes" }),
            expect.objectContaining({ canUpgrade: false, enabled: true, installName: "pstdio-planner" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-reports" }),
            expect.objectContaining({ enabled: true, installName: "pstdio-skills" }),
          ]),
        );

        const templatesRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/templates`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(templatesRes.status).toBe(200);

        const templates = (await templatesRes.json()) as Array<{
          install_name?: string;
          is_default: boolean;
          name: string;
          template_type: string;
        }>;
        expect(templates).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              install_name: "pstdio-reports",
              is_default: false,
              name: "review",
              template_type: "report",
            }),
            expect.objectContaining({
              install_name: "pstdio-reports",
              is_default: false,
              name: "change-request",
              template_type: "report",
            }),
          ]),
        );

        const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(metadataRes.status).toBe(200);
        const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
        const webview = metadata.settingsPanels.find((panel) => panel.webview)?.webview;
        expect(webview?.runtimeUrl).toBeTruthy();

        const runtimeRes = await fetch(`${started.baseUrl}${webview!.runtimeUrl}`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(runtimeRes.status).toBe(200);

        const runtimeScript = await runtimeRes.text();
        expect(runtimeScript).toContain("notification.action");
        expect(runtimeScript).toContain("notification.resolve");
        expect(runtimeScript).toContain("notification.dismiss");
        expect(runtimeScript).toContain("terminal.session");
      } finally {
        if (child) {
          await stopProcess(child);
        }
        if (closeRegistry) {
          await closeRegistry();
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT,
  );
});
