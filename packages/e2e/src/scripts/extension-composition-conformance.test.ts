import { describe, expect, test } from "bun:test";
import { dirname, join, resolve } from "node:path";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";

// Cross-layer conformance for the shipped composition fixtures: the Planner owns the
// ticket resource, while the Extension Lab owns only its own resources. A regression
// in either manifest fails here instead of in a browser.

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "../../../..");
const plannerPath = join(repoRoot, "extensions/pstdio-planner");
const labPath = join(repoRoot, "extensions/extension-lab");

const loadRuntime = async (paths: string[]) => {
  const loaded = await loadExtensionSources({
    extensionPackages: paths.map((path) => ({ path, sourceKind: "local_path" as const })),
  });
  return normalizeExtensionSources(loaded.sources, loaded.diagnostics);
};

describe("shipped extension composition", () => {
  test("normalizes the Planner and Extension Lab with no diagnostics", async () => {
    const runtime = await loadRuntime([plannerPath, labPath]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.resourceKinds.map((kind) => [kind.localId, kind.extensionId])).toEqual([
      ["ticket", "pstdio.pstdio-planner"],
      ["glass-lab-artifact", "pstdio.extension-lab"],
      ["blend-project", "pstdio.extension-lab"],
    ]);
    expect(runtime.resourceViews.find((view) => view.localId === "ticket-editor")?.contribution).toMatchObject({
      view: { kind: "view", id: "ticket-editor" },
      slot: { id: "primary" },
    });
    expect(
      runtime.placements.find((placement) => placement.localId === "ticket-primary.project")?.contribution,
    ).toMatchObject({
      item: { kind: "resource-slot", slot: { id: "primary" } },
      region: "main",
      required: true,
    });
  });

  test("normalizes Extension Lab without Planner or missing contribution diagnostics", async () => {
    const runtime = await loadRuntime([labPath]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.resourceViews.map((view) => view.localId)).toContain("artifact-detail");
  });

  test("arranges one shared resource differently in the Animation and Sculpt modes", async () => {
    const runtime = await loadRuntime([labPath]);
    const placementFor = (id: string) => runtime.placements.find((placement) => placement.localId === id)?.contribution;

    expect(placementFor("blend-primary.animation")).toMatchObject({
      item: { kind: "resource-slot", slot: { id: "primary" } },
      region: "main",
      required: true,
    });
    expect(placementFor("blend-navigation.animation")).toMatchObject({
      item: { kind: "resource-slot", slot: { id: "navigation" } },
      region: "sidenav",
      required: true,
    });
    expect(placementFor("blend-inspector.animation")).toMatchObject({
      item: { kind: "resource-slot", slot: { id: "inspector" } },
      region: "side",
      movableTo: ["side", "secondary"],
    });
    expect(placementFor("blend-navigation.sculpt")?.region).toBe("side");
    expect(placementFor("blend-inspector.sculpt")?.region).toBe("secondary");
  });

  test("keeps the Lab status bar out of docked layout", async () => {
    const runtime = await loadRuntime([labPath]);

    expect(runtime.statusBarItems.map((item) => item.localId)).toEqual(["lab"]);
    expect(
      runtime.placements.some(
        (placement) => placement.contribution.item.kind === "view" && placement.contribution.item.view.id === "status",
      ),
    ).toBe(false);
  });
});
