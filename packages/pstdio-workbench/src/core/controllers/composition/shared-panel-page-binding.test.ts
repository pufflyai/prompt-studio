import { expect, test } from "bun:test";
import { isWorkbenchPanelPlacementVisible } from "../../registries/layout/panel-widget-eligibility";
import { createWorkbench } from "../../workbench-core";
import { navigate, page, resource } from "./placement-lifecycle-test-support";

for (const owner of ["shell", "mode"] as const) {
  test.each([
    "side",
    "secondary",
  ] as const)(`a shared ${owner} resource dropped from %s into Home remains visible`, async (region) => {
    const w = createWorkbench({
      resolvePagePersistenceScope: ({ resource, pageId }) => ({
        scope: resource?.id ?? pageId,
        carryRegions: ["side", "secondary"],
      }),
    });
    w.modes.registerMode({ id: "edit", activate() {} });
    w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
    for (const id of ["home", "workspace"])
      w.pages.registerPage({
        id,
        ref: page(id),
        path: id,
        modeId: "edit",
        ...(id === "workspace"
          ? { parentId: "home", resource: { kinds: [{ kind: "resource-kind" as const, id: "workspace" }] } }
          : {}),
        main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
        slots: [],
      });
    w.pageLocations.setProject("project");
    const declaration = {
      id: "shared-resource",
      region,
      item: {
        kind: "binding",
        binding: {
          view: { kind: "view", id: "editor" },
          kinds: [{ kind: "resource-kind", id: "file" }],
          cardinality: "many",
        },
      },
    } as const;
    const ref = { kind: "placement", extensionId: "test", id: declaration.id } as const;
    if (owner === "shell") w.shellPlacements.registerPlacement(declaration);
    else w.modePlacements.registerPlacement({ ...declaration, modeId: "edit", ref });
    await w.navigation.openTarget(navigate("alpha"));
    if (owner === "shell")
      w.shellPlacements.openPlacement({ placementId: declaration.id, resource: resource("kept"), open: "pin" });
    else w.modePlacements.openPlacement({ panel: ref, resource: resource("kept"), open: "pin" });
    const original = w.layout.listPanelInstances(region)[0]!;
    await w.navigation.openTarget({ kind: "page", page: page("home") });
    w.movePanel(original.instanceId, "main");

    const moved = w.layout.getLayout().regions.main.widgets.find((tab) => tab.widgetId === original.instanceId)!;
    expect(moved).toMatchObject({ resource: resource("kept"), pinned: true, tabRetention: "persistent" });
    expect(
      isWorkbenchPanelPlacementVisible(
        w.layout.getWidget(moved.contributionId)!,
        w.getPrimaryResource(),
        "edit",
        moved,
      ),
    ).toBe(true);
    expect(w.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
  });
}
