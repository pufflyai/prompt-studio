import { describe, expect, test } from "bun:test";
import { dirname, join, resolve } from "node:path";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";

// Cross-layer conformance for the shipped composition fixtures: the Planner owns the
// ticket resource, the Extension Lab owns its own resources and contributes an
// inspector into the Planner's open ticket slot. These are the PS-255 scenario
// fixtures, so a regression in either manifest fails here instead of in a browser.

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
    // A resource kind keeps the plain name its extension declared; the owner is the
    // `extensionId` on the record, not a prefix on the id.
    expect(runtime.resourceKinds.map((kind) => [kind.id, kind.extensionId])).toEqual([
      ["ticket", "pstdio.pstdio-planner"],
      ["glass-lab-artifact", "pstdio.extension-lab"],
      ["blend-project", "pstdio.extension-lab"],
    ]);
  });

  test("resolves the Lab's cross-extension inspector into the Planner ticket slot", async () => {
    const runtime = await loadRuntime([plannerPath, labPath]);

    // The Lab writes the namespaced spelling `pstdio-planner.ticket`; it resolves to the
    // Planner's declared kind.
    const external = runtime.resourcePanels.find((edge) => edge.id === "extension-lab.ticketInsights");
    expect(external).toMatchObject({
      resourceKindId: "ticket",
      panelId: "extension-lab.labArtifacts",
      slotId: "inspector",
    });
    // The Planner's own primary placement is untouched by the external contribution.
    expect(runtime.resourcePanels.find((edge) => edge.slotId === "primary")).toMatchObject({
      resourceKindId: "ticket",
      panelId: "pstdio-planner.ticketEditor",
    });
  });

  test("produces the same records and no diagnostics when source order is reversed", async () => {
    const forward = await loadRuntime([plannerPath, labPath]);
    const reversed = await loadRuntime([labPath, plannerPath]);

    expect(reversed.diagnostics).toEqual([]);
    const ids = (runtime: typeof forward) => runtime.resourcePanels.map((edge) => edge.id).sort();
    expect(ids(reversed)).toEqual(ids(forward));
  });

  test("arranges one shared resource differently in the Animation and Sculpt modes", async () => {
    const runtime = await loadRuntime([labPath]);
    const recipeFor = (modeId: string) =>
      runtime.modes.find((mode) => mode.contribution.id === modeId)?.contribution.resources?.["blend-project"];

    const animation = recipeFor("pstdio.extension-lab.animation");
    const sculpt = recipeFor("pstdio.extension-lab.sculpt");

    expect(animation?.slots?.primary).toMatchObject({ region: "main", required: true });
    expect(sculpt?.slots?.primary).toMatchObject({ region: "main", required: true });
    // The same resource keeps its primary location while its supporting panels move.
    expect(animation?.slots?.navigation?.region).toBe("sidenav");
    expect(sculpt?.slots?.navigation?.region).toBe("side");
    expect(animation?.slots?.inspector?.region).toBe("side");
    expect(sculpt?.slots?.inspector?.region).toBe("secondary");
  });

  test("keeps the Lab status bar out of docked layout", async () => {
    const runtime = await loadRuntime([labPath]);

    expect(runtime.statusItems.map((item) => item.id)).toEqual(["extension-lab.labStatusBar"]);
    expect(runtime.panels.map((panel) => panel.id)).not.toContain("extension-lab.labStatusBar");
  });
});
