import { describe, expect, test } from "bun:test";
import { dirname, join, resolve } from "node:path";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";

// Cross-layer conformance for the shipped page compositions: the Planner owns the
// ticket resource and presents it through its tickets page, while the Extension Lab
// exercises pages plus the one remaining mode. A regression in either manifest fails
// here instead of in a browser.

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
  });

  test("the Planner declares its whole tool screen as one page", async () => {
    const runtime = await loadRuntime([plannerPath]);
    const page = runtime.pages.find((candidate) => candidate.localId === "tickets");

    expect(runtime.diagnostics).toEqual([]);
    expect(page?.contribution).toMatchObject({
      path: "tickets",
      slots: [
        { id: "board", region: "main", closable: false },
        { id: "ticket", region: "main", cardinality: "many" },
        { id: "files", region: "sidenav", follows: "ticket" },
      ],
    });
    expect(page?.contribution.bindings).toEqual([
      expect.objectContaining({
        resourceKind: expect.objectContaining({ id: "ticket" }),
        view: expect.objectContaining({ id: "ticket-editor" }),
        slot: "ticket",
      }),
      expect.objectContaining({
        resourceKind: expect.objectContaining({ id: "ticket" }),
        view: expect.objectContaining({ id: "ticket-files" }),
        slot: "files",
      }),
    ]);
    // Pages replaced placements and resource-views entirely for the Planner.
    expect(runtime.placements).toEqual([]);
    const navigation = runtime.navigationItems.find((item) => item.localId === "tickets");
    expect(navigation?.contribution.action).toMatchObject({
      kind: "page",
      page: expect.objectContaining({ id: "tickets" }),
    });
  });

  test("the Extension Lab keeps one mode with static placements and presents artifacts on two pages", async () => {
    const runtime = await loadRuntime([labPath]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.modes.map((mode) => mode.localId)).toEqual(["lab"]);
    expect(runtime.placements.map((placement) => placement.localId).sort()).toEqual(["status.lab", "workflow.lab"]);
    for (const placement of runtime.placements) {
      expect(placement.contribution.item.kind).toBe("view");
    }

    const pageIds = runtime.pages.map((page) => page.localId).sort();
    expect(pageIds).toEqual(["blend", "lab", "lab-faulty", "lab-webview"]);

    // The same artifact kind is bound by both pages, so the caller's page choice is
    // the presentation choice.
    const artifactBindings = runtime.pages.filter((page) =>
      (page.contribution.bindings ?? []).some((binding) => binding.resourceKind.id === "glass-lab-artifact"),
    );
    expect(artifactBindings.map((page) => page.localId).sort()).toEqual(["blend", "lab"]);
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
