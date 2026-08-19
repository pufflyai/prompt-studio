import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectNotFoundError } from "../../services/extension-service";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const makeSourceDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-runtime-catalog-failure-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "package.json"), "{}");
  return dir;
};

const sourceRow = (sourcePath: string) => ({
  instance: { id: "instance-1", namespace: "lab", enabled: true },
  installedSource: {
    id: "source-1",
    extension_id: "pstdio.lab",
    source_kind: "local_path" as const,
    source_path: sourcePath,
    status: "loaded",
  },
});

const createHarness = (input: { listEnabledSources: (projectId: string) => Promise<ReturnType<typeof sourceRow>[]> }) =>
  createProjectExtensionRuntimeCatalog({
    extensionService: { listEnabledSourcesForProject: input.listEnabledSources } as never,
    projectService: { get: async (id: string) => ({ id, name: "Project", shorthand: "PS" }) } as never,
    repoService: { listByProject: async () => [] } as never,
    loadSources: async () => ({ sources: [], diagnostics: [] }),
  });

describe("project extension runtime catalog failures", () => {
  test("a read for a missing project fails with extension_runtime_project_missing", async () => {
    const catalog = createProjectExtensionRuntimeCatalog({
      extensionService: { listEnabledSourcesForProject: async () => [] } as never,
      projectService: { get: async () => null } as never,
      repoService: { listByProject: async () => [] } as never,
    });

    expect.assertions(2);
    try {
      await catalog.get("gone");
    } catch (error) {
      expect((error as { code: string }).code).toBe("extension_runtime_project_missing");
      expect(error).toBeInstanceOf(ProjectNotFoundError);
    }
  });

  test("a cold read with no healthy snapshot fails with extension_runtime_load_failed and retries", async () => {
    const dir = makeSourceDir();
    let failing = true;
    const catalog = createHarness({
      listEnabledSources: async () => {
        if (failing) throw new Error("database unavailable");
        return [sourceRow(dir)];
      },
    });

    const failure = (await catalog.get("p1").catch((error) => error)) as { code: string };
    expect(failure.code).toBe("extension_runtime_load_failed");

    failing = false;
    const snapshot = await catalog.get("p1");
    expect(snapshot.generation).toBe(1);
    expect(snapshot.stale).toBeNull();
  });

  test("a whole-load failure keeps the last healthy snapshot marked stale, then recovers", async () => {
    const dir = makeSourceDir();
    let failing = false;
    const catalog = createHarness({
      listEnabledSources: async () => {
        if (failing) throw new Error("database unavailable");
        return [sourceRow(dir)];
      },
    });

    const healthy = await catalog.get("p1");
    catalog.invalidate({ projectId: "p1", reason: "enablement_changed" });
    failing = true;

    const stale = await catalog.get("p1");
    expect(stale.generation).toBe(healthy.generation);
    expect(stale.runtime).toBe(healthy.runtime);
    expect(stale.enabledSources).toBe(healthy.enabledSources);
    expect(stale.stale?.code).toBe("extension_runtime_load_failed");
    expect(Object.isFrozen(stale)).toBe(true);

    // Repeated failing reads reuse the same stale view and keep retrying the load.
    const staleAgain = await catalog.get("p1");
    expect(staleAgain).toBe(stale);

    failing = false;
    const recovered = await catalog.get("p1");
    expect(recovered.generation).toBe(healthy.generation + 1);
    expect(recovered.stale).toBeNull();
  });

  test("the retained healthy snapshot itself is never mutated by a failed load", async () => {
    const dir = makeSourceDir();
    let failing = false;
    const catalog = createHarness({
      listEnabledSources: async () => {
        if (failing) throw new Error("database unavailable");
        return [sourceRow(dir)];
      },
    });

    const healthy = await catalog.get("p1");
    catalog.invalidate({ projectId: "p1", reason: "enablement_changed" });
    failing = true;
    const stale = await catalog.get("p1");

    expect(healthy.stale).toBeNull();
    expect(stale).not.toBe(healthy);
  });
});
