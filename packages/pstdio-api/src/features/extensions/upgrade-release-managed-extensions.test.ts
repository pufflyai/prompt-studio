import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createTestHarnessRegistry } from "../harnesses/test-harness-registry";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createTestApp>>;

const releaseCommit = "f".repeat(40);
const releaseRef = (installName: string, commit: string) =>
  `https://github.com/pufflyai/prompt-studio@${commit}#extensions/${installName}`;

let handle: AppHandle;
let originalDefaultExtensions: string | undefined;
let originalPstdioHome: string | undefined;
let tempRoot: string;

beforeAll(() => {
  originalDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  originalPstdioHome = process.env.PSTDIO_HOME;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-release-upgrades-test-"));
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
});

afterAll(async () => {
  await handle?.close();
  if (originalDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = originalDefaultExtensions;
  if (originalPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = originalPstdioHome;
  rmSync(tempRoot, { recursive: true, force: true });
});

const enableSource = async (
  projectId: string,
  fields: { installName: string; displayName: string; sourceRef: string | null; enginesPstdio?: string },
) => {
  const sourcePath = createTestExtensionSource({
    root: process.env.PSTDIO_HOME!,
    name: fields.installName,
    displayName: fields.displayName,
    installName: fields.installName,
    version: "1.0.0",
  });
  const loaded = await loadExtensionSource(sourcePath);
  return handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    installName: fields.installName,
    manifest: fields.enginesPstdio ? { ...loaded.manifest, enginesPstdio: fields.enginesPstdio } : loaded.manifest,
    name: loaded.metadata.name,
    projectId,
    sourceHash: hashExtensionSource(sourcePath),
    sourceKind: fields.sourceRef ? "git" : "local_path",
    sourceRef: fields.sourceRef,
    sourcePath,
    version: "1.0.0",
  });
};

describe("release-managed extension upgrades", () => {
  test("startup upgrades a shared release once and migrates every project while preserving local edits", async () => {
    const plannerPath = join(tempRoot, "pstdio-home", "extensions", "pstdio-planner");
    const installExtensionSource = mock(async () => {
      writeFileSync(
        join(plannerPath, "extension.ts"),
        `export default {
        hooks: [{ id: "migrate", ref: { kind: "hook", id: "migrate" },
          event: { extensionId: "pstdio", kind: "event", id: "project.opened" },
          async run(ctx) {
            await ctx.projectFiles.writeText("migrated.txt", ctx.projectId);
          }
        }]
      };`,
      );
      const loaded = await loadExtensionSource(plannerPath);
      return {
        check: { errorCount: 0 },
        installName: "pstdio-planner",
        manifest: { ...loaded.manifest, version: "2.0.0" },
        metadata: { ...loaded.metadata, version: "2.0.0" },
        source: { kind: "named" as const, name: "pstdio-planner", ref: releaseRef("pstdio-planner", releaseCommit) },
        sourceHash: hashExtensionSource(plannerPath),
        targetPath: plannerPath,
      };
    }) as never;
    const options = {
      databasePath: join(tempRoot, "database"),
      storageRoot: join(tempRoot, "storage"),
      harnessRegistry: createTestHarnessRegistry([]),
      release: { source: "git" as const, ref: releaseCommit },
      installExtensionSource,
    };
    handle = await createTestApp(options);
    const input = folderProjectInput({ name: "Release Upgrades" });
    const projectResponse = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const project = (await projectResponse.json()) as { id: string };

    await enableSource(project.id, {
      installName: "pstdio-planner",
      displayName: "Prompt Studio Planner",
      sourceRef: releaseRef("pstdio-planner", "a".repeat(40)),
    });
    const secondInput = folderProjectInput({ name: "Shared Release" });
    const secondResponse = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(secondInput),
    });
    expect(secondResponse.status).toBe(201);
    const second = (await secondResponse.json()) as { id: string };
    await enableSource(second.id, {
      installName: "pstdio-planner",
      displayName: "Prompt Studio Planner",
      sourceRef: releaseRef("pstdio-planner", "a".repeat(40)),
    });
    // A catalog extension without install provenance may be a copy someone edited. Its recovery
    // upgrade stays on offer instead of replacing it.
    await enableSource(project.id, {
      installName: "pstdio-skills",
      displayName: "Prompt Studio Skills",
      sourceRef: null,
      enginesPstdio: "1.0.0-alpha.1",
    });

    // A release copy someone edited on disk holds their work, so it is not replaced either.
    const reports = await enableSource(project.id, {
      installName: "pstdio-reports",
      displayName: "Prompt Studio Reports",
      sourceRef: releaseRef("pstdio-reports", "a".repeat(40)),
    });
    appendFileSync(join(reports.installedSource.source_path, "extension.ts"), "// local edit\n");

    await handle.close();
    handle = await createTestApp(options);
    const projects = [
      { id: project.id, path: input.initial_workspace.params.path },
      { id: second.id, path: secondInput.initial_workspace.params.path },
    ];
    const deadline = Date.now() + 2_000;
    while (projects.some(({ path }) => !existsSync(join(path, "migrated.txt"))) && Date.now() < deadline) {
      await Bun.sleep(10);
    }
    for (const { id, path } of projects) {
      expect(existsSync(join(path, "migrated.txt"))).toBe(true);
      expect(readFileSync(join(path, "migrated.txt"), "utf8")).toBe(id);
    }

    expect(installExtensionSource).toHaveBeenCalledTimes(1);
    expect(installExtensionSource).toHaveBeenCalledWith(expect.objectContaining({ source: "pstdio-planner" }));
    const listed = await handle.app.request(`/v1/projects/${project.id}/extensions`);
    const { extensions } = (await listed.json()) as {
      extensions: Array<{ canUpgrade: boolean; installName: string; version: string | null }>;
    };
    expect(extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canUpgrade: false, installName: "pstdio-planner", version: "2.0.0" }),
        expect.objectContaining({ installName: "pstdio-skills", version: "1.0.0" }),
        expect.objectContaining({ canUpgrade: true, installName: "pstdio-reports", version: "1.0.0" }),
      ]),
    );
  });
});
