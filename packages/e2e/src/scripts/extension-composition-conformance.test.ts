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
    ]);
    expect(runtime.resourceViews.find((view) => view.localId === "ticket-editor")?.contribution).toMatchObject({
      view: { kind: "view", id: "ticket-editor" },
      slot: { id: "primary" },
    });
    expect(runtime.placements.filter((placement) => placement.extensionId === "pstdio.pstdio-planner")).toEqual([]);
    expect(runtime.pages.find((page) => page.localId === "tickets")?.contribution).toMatchObject({
      path: "tickets",
      slots: [{ id: "content", role: "primary", region: "main", view: { id: "tickets" } }],
    });
    expect(runtime.pages.find((page) => page.localId === "ticket")?.contribution).toMatchObject({
      path: "ticket",
      parent: { id: "tickets" },
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          binding: { kind: { id: "ticket" }, view: { id: "ticket-editor" } },
        },
      ],
    });
    expect(runtime.navigationTrees.find((tree) => tree.localId === "ticket-files")?.contribution).toMatchObject({
      owner: { kind: "page", id: "ticket" },
      slot: "content",
      view: { kind: "view", id: "ticket-files" },
    });
  });

  test("normalizes Extension Lab without Planner or missing contribution diagnostics", async () => {
    const runtime = await loadRuntime([labPath]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.resourceViews.map((view) => view.localId)).toContain("artifact-detail");
  });

  test("keeps Lab page navigation in the composed Sidenav contract", async () => {
    const runtime = await loadRuntime([labPath]);

    expect(runtime.modes.map((mode) => mode.localId)).toEqual(["lab"]);
    expect(runtime.placements.map((placement) => placement.contribution.region)).not.toContain("sidenav");
    expect(runtime.navigationTrees.find((tree) => tree.localId === "lab-cameras")?.contribution).toMatchObject({
      owner: { kind: "page", id: "lab" },
      slot: "content",
      view: { kind: "view", id: "camera-tree" },
    });
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
