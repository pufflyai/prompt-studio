import { describe, expect, test } from "bun:test";
import { dirname, join, resolve } from "node:path";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";

// Keep resource ownership valid when the Planner, showcases, and host fixtures are composed.
const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "../../../..");
const plannerPath = join(repoRoot, "extensions/pstdio-planner");
const labPath = join(repoRoot, "extensions/extension-lab");
const fixturePath = join(repoRoot, "packages/workbench-fixture");
const loadRuntime = async (paths: string[]) => {
  const loaded = await loadExtensionSources({
    extensionPackages: paths.map((path) => ({ path, sourceKind: "local_path" as const })),
  });
  return normalizeExtensionSources(loaded.sources, loaded.diagnostics);
};
describe("shipped extension composition", () => {
  test("normalizes the Planner and Extension Lab with no diagnostics", async () => {
    const runtime = await loadRuntime([plannerPath, labPath, fixturePath]);
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.resourceKinds.map((kind) => [kind.localId, kind.extensionId])).toEqual([
      ["ticket", "pstdio.pstdio-planner"],
      ["scribble.document", "pstdio.extension-lab"],
      ["boombox.track", "pstdio.extension-lab"],
      ["zipline.issue", "pstdio.extension-lab"],
      ["pigeon.thread", "pstdio.extension-lab"],
      ["kiln.object", "pstdio.extension-lab"],
      ["glass-lab-artifact", "pstdio.workbench-fixture"],
    ]);
    expect(runtime.placements.filter((placement) => placement.extensionId === "pstdio.pstdio-planner")).toEqual([]);
    expect(runtime.pages.find((page) => page.localId === "tickets")?.contribution).toMatchObject({
      path: "tickets",
      main: {
        kind: "view",
        view: { id: "tickets" },
        cardinality: "one",
      },
      slots: [],
    });
    expect(runtime.pages.find((page) => page.localId === "ticket")?.contribution).toMatchObject({
      path: "ticket",
      parent: { id: "tickets" },
      resource: {
        kinds: [{ id: "ticket" }],
      },
      main: {
        kind: "view",
        view: { id: "ticket-editor" },
        cardinality: "one",
      },
      slots: [],
    });
    expect(runtime.navigationTrees.find((tree) => tree.localId === "ticket-files")?.contribution).toMatchObject({
      owner: { kind: "page", id: "ticket" },
      slot: "content",
      view: { kind: "view", id: "ticket-files" },
    });
  });
  test("normalizes host fixtures without Planner or missing contribution diagnostics", async () => {
    const runtime = await loadRuntime([fixturePath]);
    expect(runtime.diagnostics).toEqual([]);
    const artifactSlot = runtime.pages
      .find((page) => page.localId === "lab-mode")
      ?.contribution.slots.find((slot) => slot.id === "artifact");
    expect(artifactSlot).toMatchObject({
      id: "artifact",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ id: "glass-lab-artifact" }],
          view: { id: "artifact-detail" },
          cardinality: "many",
        },
      },
    });
  });
  test("keeps fixture page navigation in the composed Sidenav contract", async () => {
    const runtime = await loadRuntime([fixturePath]);
    expect(runtime.modes.map((mode) => mode.localId)).toEqual(["lab"]);
    expect(runtime.placements.map((placement) => placement.contribution.region)).not.toContain("sidenav");
    expect(runtime.navigationTrees.find((tree) => tree.localId === "lab-cameras")?.contribution).toMatchObject({
      owner: { kind: "page", id: "lab" },
      slot: "content",
      view: { kind: "view", id: "camera-tree" },
    });
  });
  test("keeps the fixture status bar out of docked layout", async () => {
    const runtime = await loadRuntime([fixturePath]);
    expect(runtime.statusBarItems.map((item) => item.localId)).toEqual(["lab"]);
    expect(
      runtime.placements.some(
        (placement) => placement.contribution.item.kind === "view" && placement.contribution.item.view.id === "status",
      ),
    ).toBe(false);
  });
});
