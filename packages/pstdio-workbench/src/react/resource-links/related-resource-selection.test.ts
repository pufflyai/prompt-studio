import { expect, test } from "bun:test";
import { opening, ref, setup } from "./related-resource-openings.fixture";

const cases = (["side", "secondary"] as const).flatMap((region) =>
  (["page", "shell", "mode"] as const).flatMap((presentation) =>
    [false, true].map((open) => ({ region, presentation, open })),
  ),
);

test.each(cases)("a $region panel with open=$open handles related $presentation selection", async ({
  region,
  presentation,
  open,
}) => {
  const s = setup([opening("related", region)]);
  const binding = {
    view: { kind: "view", id: "document" },
    kinds: [{ kind: "resource-kind", id: "document" }],
    cardinality: "many",
  } as const;
  s.workbench.shellPlacements.registerPlacement({ id: "kept", region, item: { kind: "binding", binding } });
  s.workbench.shellPlacements.openPlacement({ placementId: "kept", resource: ref("document", "kept"), open: "pin" });
  const panel = { kind: "placement", id: "native", extensionId: "example" } as const;
  if (presentation === "shell")
    s.workbench.shellPlacements.registerPlacement({ id: "native", region, item: { kind: "binding", binding } });
  if (presentation === "mode")
    s.workbench.modePlacements.registerPlacement({
      id: "native",
      ref: panel,
      modeId: "project",
      region,
      item: { kind: "binding", binding },
    });
  if (presentation !== "page")
    s.service.resolve = async (resources) =>
      resources.map((resource) => ({
        resource,
        target:
          presentation === "shell"
            ? { kind: "panel", resource, panel: { kind: "shell-placement", id: "native" } }
            : { kind: "panel", resource, panel },
      }));
  s.workbench.layout.activateWidget(s.workbench.layout.listPanelInstances("main")[0]!.instanceId);
  const active = s.workbench.layout.getLayout().activeWidgetId;
  s.workbench.shell.setRegionOpen(region, open);
  await s.controller.open(s.source);
  expect(s.workbench.shell.getRegionState(region).open).toBe(true);
  expect(s.workbench.layout.getActivePanel(region)?.resource?.id).toBe(open ? "kept" : "related");
  expect(s.workbench.layout.getLayout().activeWidgetId).toBe(active);
  expect(s.workbench.pages.store.getState().location?.resource?.id).toBe(s.source.id);
  s.controller.dispose();
});

test.each([
  "side",
  "secondary",
] as const)("a closed %s panel selects an existing target in its actual tray", async (region) => {
  const s = setup([opening("related", region === "side" ? "secondary" : "side")]);
  s.workbench.shellPlacements.registerPlacement({
    id: "native",
    region,
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
  for (const id of ["related", "kept"])
    s.workbench.shellPlacements.openPlacement({ placementId: "native", resource: ref("document", id), open: "pin" });
  s.workbench.layout.activateWidget(s.workbench.layout.listPanelInstances("main")[0]!.instanceId);
  s.workbench.shell.setRegionOpen(region, false);
  await s.controller.open(s.source);
  expect(s.workbench.shell.getRegionState(region).open).toBe(true);
  expect(s.workbench.layout.getActivePanel(region)?.resource?.id).toBe("related");
  expect(s.workbench.layout.listPanelInstances(region)).toHaveLength(2);
  expect(s.workbench.layout.getActivePanel(region)?.tabRetention).toBe("persistent");
  s.controller.dispose();
});
