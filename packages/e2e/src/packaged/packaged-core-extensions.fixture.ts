import { expect } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { removeDiagnosticNativeCore } from "./diagnostic-native-core-cleanup";
import { preparePlannerSource } from "./packaged-planner-source";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

// Keep the existing allowance for cold core-extension installation on Intel macOS.
export const CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT = 120_000;
const REPO_ROOT = join(import.meta.dirname, "../../../..");
const CORE_DEFAULT_EXTENSION_NAMES = [
  "harness-claude-code",
  "harness-codex",
  "harness-open-code",
  "pstdio-base-themes",
  "pstdio-planner",
  "pstdio-notes",
  "pstdio-reports",
  "pstdio-skills",
];

interface CoreExtensionsFixture {
  started: Awaited<ReturnType<typeof startPackagedServe>>;
  tempRoot: string;
  projectFolder: string;
  project: { extension_warnings?: unknown[]; id: string };
  extensions: { canUpgrade: boolean; enabled: boolean; id: string; installName: string; name: string }[];
  metadata: WorkbenchExtensionMetadata;
}

export const withPackagedCoreExtensions = async (run: (fixture: CoreExtensionsFixture) => Promise<void>) => {
  const startedAt = Date.now();
  const phase = (name: string) => console.log(`Packaged core: ${name} (${Date.now() - startedAt}ms)`);
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-core-"));
  let child: ChildProcess | undefined;
  let closeRegistry: (() => Promise<void>) | undefined;
  try {
    const npmConfigPath = join(tempRoot, ".npmrc");
    const registry = await startLocalWorkspaceRegistry({
      configPath: npmConfigPath,
      outputRoot: tempRoot,
      packagePaths: [join(REPO_ROOT, "packages/sdk"), join(REPO_ROOT, "packages/ui")],
    });
    closeRegistry = registry.close;
    phase("registry ready");
    const plannerSource = await preparePlannerSource(tempRoot);
    phase("Planner source ready");
    const started = await startPackagedServe(tempRoot, {
      NPM_CONFIG_USERCONFIG: npmConfigPath,
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
        defaultExtensions: CORE_DEFAULT_EXTENSION_NAMES.map((installName) => ({
          installName,
          source: installName === "pstdio-planner" ? plannerSource : join(REPO_ROOT, "extensions", installName),
        })),
      }),
    });
    child = started.child;
    phase("runtime ready");
    const projectFolder = join(tempRoot, "project");
    mkdirSync(projectFolder);
    const headers = runtimeAuthorization(started.descriptor);
    const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "packaged-core-extensions-project" }, projectFolder)),
    });
    expect(createRes.status).toBe(201);
    const project = (await createRes.json()) as CoreExtensionsFixture["project"];
    phase("project created");
    const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, { headers });
    expect(extensionsRes.status).toBe(200);
    const { extensions } = (await extensionsRes.json()) as { extensions: CoreExtensionsFixture["extensions"] };
    phase("extensions listed");
    const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, { headers });
    expect(metadataRes.status).toBe(200);
    const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
    phase("UI metadata loaded");
    await run({ started, tempRoot, projectFolder, project, extensions, metadata });
    phase("features checked");
  } finally {
    if (child) await stopProcess(child);
    phase("runtime stopped");
    if (closeRegistry) await closeRegistry();
    phase("registry closed");
    await removeDiagnosticNativeCore(tempRoot);
    phase("files removed");
  }
};
