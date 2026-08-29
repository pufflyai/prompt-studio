import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { loadExtensionSources } from "pstdio-extensions";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// The catalog only asks the loader for directories that hold a package.json;
// the loader itself is faked, so an empty manifest file is enough.
const makeSourceDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-runtime-catalog-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "package.json"), "{}");
  return dir;
};

const sourceRow = (sourcePath: string, suffix = "1") => ({
  instance: { id: `instance-${suffix}`, namespace: `lab-${suffix}`, enabled: true },
  installedSource: {
    id: `source-${suffix}`,
    extension_id: `pstdio.lab-${suffix}`,
    source_kind: "local_path" as const,
    source_path: sourcePath,
    status: "loaded",
  },
});

type SourceRows = ReturnType<typeof sourceRow>[];

const createHarness = (input: {
  sourcesByProject: (projectId: string) => SourceRows;
  loadGate?: () => Promise<void>;
}) => {
  const loaderCalls: string[] = [];
  const loadStarts: Array<{ projectId: string; reason: string }> = [];
  const publishes: Array<{ projectId: string; generation: number }> = [];
  const discards: string[] = [];

  const loadSources: typeof loadExtensionSources = async (options) => {
    loaderCalls.push(options?.extensionPackages?.[0]?.path ?? "");
    await input.loadGate?.();
    return { sources: [], diagnostics: [] };
  };

  const catalog = createProjectExtensionRuntimeCatalog({
    extensionService: { listEnabledSourcesForProject: async (id: string) => input.sourcesByProject(id) } as never,
    projectService: { get: async (id: string) => ({ id, name: `Project ${id}`, shorthand: "PS" }) } as never,
    repoService: { listByProject: async () => [] } as never,
    loadSources,
    observer: {
      onLoadStart: (event) => loadStarts.push({ projectId: event.projectId, reason: event.reason }),
      onPublish: (event) => publishes.push({ projectId: event.projectId, generation: event.generation }),
      onDiscard: (event) => discards.push(event.projectId),
    },
  });

  return { catalog, discards, loaderCalls, loadStarts, publishes };
};

describe("project extension runtime catalog", () => {
  test("repeated reads return the same published snapshot identity", async () => {
    const dir = makeSourceDir();
    const harness = createHarness({ sourcesByProject: () => [sourceRow(dir)] });

    const first = await harness.catalog.get("p1");
    const second = await harness.catalog.get("p1");

    expect(second).toBe(first);
    expect(first.generation).toBe(1);
    expect(first.project).toEqual({ id: "p1", name: "Project p1", shorthand: "PS" });
    expect(first.enabledSources).toHaveLength(1);
    expect(first.stale).toBeNull();
    expect(harness.loaderCalls).toHaveLength(1);
    expect(harness.loadStarts).toHaveLength(1);
  });

  test("publishes frozen snapshot data", async () => {
    const dir = makeSourceDir();
    const harness = createHarness({ sourcesByProject: () => [sourceRow(dir)] });

    const snapshot = await harness.catalog.get("p1");

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.project)).toBe(true);
    expect(Object.isFrozen(snapshot.enabledSources)).toBe(true);
    expect(Object.isFrozen(snapshot.runtime)).toBe(true);
  });

  test("concurrent cold reads share one load and one generation", async () => {
    const dir = makeSourceDir();
    const harness = createHarness({ sourcesByProject: () => [sourceRow(dir)] });

    const [first, second, third] = await Promise.all([
      harness.catalog.get("p1"),
      harness.catalog.get("p1"),
      harness.catalog.get("p1"),
    ]);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(first.generation).toBe(1);
    expect(harness.loadStarts).toHaveLength(1);
    expect(harness.publishes).toEqual([{ projectId: "p1", generation: 1 }]);
  });

  test("several invalidations before the next read coalesce into one replacement load", async () => {
    const dir = makeSourceDir();
    const harness = createHarness({ sourcesByProject: () => [sourceRow(dir)] });

    const first = await harness.catalog.get("p1");
    harness.catalog.invalidate({ projectId: "p1", reason: "enablement_changed" });
    harness.catalog.invalidate({ projectId: "p1", reason: "enablement_changed" });
    harness.catalog.invalidate({ projectId: "p1", reason: "repo_link_changed" });
    const second = await harness.catalog.get("p1");

    expect(second).not.toBe(first);
    expect(second.generation).toBe(2);
    expect(harness.loadStarts).toHaveLength(2);
    expect(harness.publishes.map((entry) => entry.generation)).toEqual([1, 2]);
  });

  test("an invalidation during a load discards the in-flight result", async () => {
    const dir = makeSourceDir();
    let releaseFirstLoad = () => {};
    let firstLoadEntered = () => {};
    const entered = new Promise<void>((resolve) => {
      firstLoadEntered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseFirstLoad = resolve;
    });
    let gated = false;
    const harness = createHarness({
      sourcesByProject: () => [sourceRow(dir)],
      loadGate: () => {
        if (gated) return Promise.resolve();
        gated = true;
        firstLoadEntered();
        return gate;
      },
    });

    const pending = harness.catalog.get("p1");
    await entered;
    harness.catalog.invalidate({ projectId: "p1", reason: "enablement_changed" });
    releaseFirstLoad();
    const snapshot = await pending;

    // The discarded load never became an observable generation; the reader got
    // a snapshot built from the latest revision instead.
    expect(snapshot.generation).toBe(1);
    expect(harness.discards).toEqual(["p1"]);
    expect(harness.loadStarts).toHaveLength(2);
    expect(harness.publishes).toEqual([{ projectId: "p1", generation: 1 }]);
    // A project-level invalidation reloads the snapshot without re-importing sources.
    expect(harness.loaderCalls).toHaveLength(1);
    expect(await harness.catalog.get("p1")).toBe(snapshot);
  });

  test("work holding an old snapshot still reads its values after invalidation", async () => {
    const dir = makeSourceDir();
    const harness = createHarness({ sourcesByProject: () => [sourceRow(dir)] });

    const captured = await harness.catalog.get("p1");
    const capturedRuntime = captured.runtime;
    harness.catalog.invalidate({ projectId: "p1", reason: "enablement_changed" });
    const replacement = await harness.catalog.get("p1");

    expect(replacement).not.toBe(captured);
    expect(captured.generation).toBe(1);
    expect(replacement.generation).toBe(2);
    expect(captured.runtime).toBe(capturedRuntime);
    expect(captured.enabledSources).toHaveLength(1);
  });

  test("a source-path invalidation affects only projects using that source", async () => {
    const dirA = makeSourceDir();
    const dirB = makeSourceDir();
    const harness = createHarness({
      sourcesByProject: (projectId) => (projectId === "p1" ? [sourceRow(dirA, "a")] : [sourceRow(dirB, "b")]),
    });

    const firstA = await harness.catalog.get("p1");
    const firstB = await harness.catalog.get("p2");
    harness.catalog.invalidate({ sourcePath: dirA, reason: "source_changed" });
    const secondB = await harness.catalog.get("p2");
    const secondA = await harness.catalog.get("p1");

    expect(secondB).toBe(firstB);
    expect(secondA).not.toBe(firstA);
    expect(secondA.generation).toBe(3);
    // Only the changed source was imported again.
    expect(harness.loaderCalls.filter((path) => path === dirA)).toHaveLength(2);
    expect(harness.loaderCalls.filter((path) => path === dirB)).toHaveLength(1);
  });

  test("a full invalidation replaces every project snapshot once", async () => {
    const dirA = makeSourceDir();
    const dirB = makeSourceDir();
    const harness = createHarness({
      sourcesByProject: (projectId) => (projectId === "p1" ? [sourceRow(dirA, "a")] : [sourceRow(dirB, "b")]),
    });

    const firstA = await harness.catalog.get("p1");
    const firstB = await harness.catalog.get("p2");
    harness.catalog.invalidate({ reason: "runtime_refresh" });
    const secondA = await harness.catalog.get("p1");
    const secondB = await harness.catalog.get("p2");

    expect(secondA).not.toBe(firstA);
    expect(secondB).not.toBe(firstB);
    expect(harness.loaderCalls.filter((path) => path === dirA)).toHaveLength(2);
    expect(harness.loaderCalls.filter((path) => path === dirB)).toHaveLength(2);
    expect(harness.publishes.map((entry) => entry.generation)).toEqual([1, 2, 3, 4]);
  });
});
