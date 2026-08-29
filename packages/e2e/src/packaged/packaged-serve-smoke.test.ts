import { beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
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
    "targets packaged workspace actions by resource kind",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot, {
          PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("extension-lab"),
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
        const workspaceAction = metadata.menuContributions.find(
          (contribution) => contribution.label === "Workspace-only lab action",
        );
        expect(workspaceAction?.when).toEqual({ resourceType: ["workspace"] });
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
        const registry = await startLocalWorkspaceRegistry({
          configPath: npmConfigPath,
          outputRoot: tempRoot,
          packagePaths: [join(REPO_ROOT, "packages/sdk"), join(REPO_ROOT, "packages/ui")],
        });
        closeRegistry = registry.close;

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

        const skillsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/skills`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(skillsRes.status).toBe(200);
        const skills = (await skillsRes.json()) as Array<{
          files: Array<{ path: string }>;
          name: string;
        }>;
        expect(skills).toContainEqual(
          expect.objectContaining({
            name: "create-pstdio-extension",
            files: expect.arrayContaining([
              expect.objectContaining({ path: "SKILL.md" }),
              expect.objectContaining({ path: "references/extension-api.md" }),
              expect.objectContaining({ path: "references/examples.md" }),
            ]),
          }),
        );

        const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(metadataRes.status).toBe(200);
        const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
        expect(metadata.settingsPanels).toContainEqual(
          expect.objectContaining({ id: "pstdio.pstdio-planner.settings-panel.ticket-board" }),
        );
        const refineTicket = metadata.commands.find((command) => command.id.endsWith(".command.refine-ticket"));
        expect(refineTicket?.params?.template).toEqual({
          type: "template",
          label: "Ticket template",
          required: false,
          templateType: "pstdio.pstdio-planner.template-type.ticket",
        });
        const reportType = metadata.templateTypes.find((type) => type.localId === "report");
        expect(reportType?.commands).toEqual(
          expect.objectContaining({
            list: "pstdio.pstdio-reports.command.templates.list",
            read: "pstdio.pstdio-reports.command.templates.read",
            save: "pstdio.pstdio-reports.command.templates.save",
            delete: "pstdio.pstdio-reports.command.templates.delete",
          }),
        );

        const listTemplatesRes = await fetch(
          `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/${encodeURIComponent(reportType!.commands!.list)}/execute`,
          {
            method: "POST",
            headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
            body: JSON.stringify({ source: "api", params: {} }),
          },
        );
        expect(listTemplatesRes.status).toBe(200);
        const listTemplates = (await listTemplatesRes.json()) as {
          outcome: { ok: boolean; value?: Array<{ name: string; type: string }> };
        };
        expect(listTemplates.outcome).toEqual(
          expect.objectContaining({
            ok: true,
            value: expect.arrayContaining([
              expect.objectContaining({ name: "review", type: "report" }),
              expect.objectContaining({ name: "change-request", type: "report" }),
            ]),
          }),
        );
        const settingsPanel = metadata.settingsPanels.find((panel) => panel.view);
        const settingsViewId = settingsPanel
          ? `${settingsPanel.view.extensionId}.view.${settingsPanel.view.id}`
          : undefined;
        const settingsView = metadata.views.find((view) => view.id === settingsViewId);
        const webview = settingsView?.body.kind === "webview" ? settingsView.body.webview : undefined;
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

test("packaged CLI includes automation and machine authentication", () => {
  const result = spawnSync(PACKAGED_BINARY_PATH, ["--help"], { encoding: "utf8" });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("pstdio automation [command]");
  expect(result.stdout).toContain("pstdio auth [command]");
});
