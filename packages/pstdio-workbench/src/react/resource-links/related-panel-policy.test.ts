import { expect, test } from "bun:test";
import { opening, ref, setup } from "./related-resource-openings.fixture";

const create = (region: "side" | "secondary") => {
  const s = setup([opening("default", region)], {
    resolvePagePersistenceScope: ({ resource, pageId }) => ({
      scope: resource?.id ?? pageId,
      carryRegions: ["side", "secondary"],
    }),
  });
  s.workbench.shellPlacements.registerPlacement({
    id: "manual",
    region,
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "session" }],
        cardinality: "many",
      },
    },
  });
  const leave = () =>
    s.workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "home", extensionId: "example" } });
  const enter = async () => {
    s.workbench.pageLocations.navigate(s.target(s.source));
    await s.controller.open(s.source);
  };
  const manual = (id: string, open: "pin" | "preview" = "pin") =>
    s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("session", id), open });
  return { ...s, region, leave, enter, manual };
};

for (const region of ["side", "secondary"] as const) {
  test(`a remembered ${region} closure hides the page preview without suppressing its placement`, async () => {
    const s = create(region);
    await s.controller.open(s.source);
    s.workbench.shell.setRegionOpen(region, false);
    s.leave();
    await s.enter();
    expect(s.workbench.shell.getRegionState(region).open).toBe(false);
    expect(s.workbench.layout.listPanelInstances(region).map((p) => [p.resource?.id, p.tabRetention])).toEqual([
      ["default", "preview"],
    ]);
    s.controller.dispose();
  });

  test(`closing the last ${region} tab remembers the chosen resource and closed panel on revisit`, async () => {
    const s = create(region);
    await s.controller.open(s.source);
    s.manual("chosen", "preview");
    s.workbench.closePlacement(s.workbench.layout.getActivePanel(region)!.placementIdentity!);
    expect(s.workbench.shell.getRegionState(region).open).toBe(false);
    s.leave();
    await s.enter();
    expect(s.workbench.shell.getRegionState(region).open).toBe(false);
    expect(s.workbench.layout.getActivePanel(region)?.resource?.id).toBe("chosen");
    s.controller.dispose();
  });

  test(`an automatically revealed ${region} panel closes on leave with its pre-existing tabs kept`, async () => {
    const s = create(region);
    s.manual("kept");
    s.workbench.shell.setRegionOpen(region, false);
    await s.controller.open(s.source);
    expect(s.workbench.shell.getRegionState(region).open).toBe(true);
    s.leave();
    expect(s.workbench.layout.listPanelInstances(region).map((p) => p.resource?.id)).toEqual(["kept"]);
    expect(s.workbench.shell.getRegionState(region).open).toBe(false);
    s.controller.dispose();
  });

  test(`a remembered ${region} preview does not take selection from an open pinned tab`, async () => {
    const s = create(region);
    await s.controller.open(s.source);
    s.manual("chosen", "preview");
    s.leave();
    s.manual("kept");
    s.workbench.shell.setRegionOpen(region, true);
    await s.enter();
    expect(s.workbench.layout.listPanelInstances(region).map((p) => p.resource?.id)).toEqual(["chosen", "kept"]);
    expect(s.workbench.layout.getActivePanel(region)?.resource?.id).toBe("kept");
    s.controller.dispose();
  });

  test(`reordering a kept tab retains an automatically revealed ${region} panel`, async () => {
    const s = create(region);
    s.manual("first");
    s.manual("second");
    s.workbench.shell.setRegionOpen(region, false);
    await s.controller.open(s.source);
    const first = s.workbench.layout.listPanelInstances(region).find((panel) => panel.resource?.id === "first")!;
    s.workbench.movePanel(first.instanceId, region, "end");
    s.leave();
    expect(s.workbench.shell.getRegionState(region).open).toBe(true);
    expect(s.workbench.layout.listPanelInstances(region).map((panel) => panel.resource?.id)).toEqual([
      "second",
      "first",
    ]);
    s.controller.dispose();
  });

  test(`owner teardown does not keep an automatically revealed ${region} panel open`, async () => {
    const s = create(region);
    s.manual("kept");
    s.workbench.shell.setRegionOpen(region, false);
    const owner = s.workbench.shellPlacements.registerPlacement({
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
    s.service.resolve = async (resources) =>
      resources.map((resource) => ({
        resource,
        target: { kind: "panel", panel: { kind: "shell-placement", id: "native" }, resource },
      }));
    await s.controller.open(s.source);
    owner.dispose();
    s.leave();
    expect(s.workbench.shell.getRegionState(region).open).toBe(false);
    expect(s.workbench.layout.listPanelInstances(region).map((panel) => panel.resource?.id)).toEqual(["kept"]);
    s.controller.dispose();
  });

  test.each([
    "pin",
    "add",
  ] as const)(`manual %s keeps an automatically revealed ${region} panel open on leave`, async (action) => {
    const s = create(region);
    await s.controller.open(s.source);
    if (action === "pin") s.workbench.pinPlacement(s.workbench.layout.getActivePanel(region)!.placementIdentity!, true);
    else s.manual("kept");
    s.leave();
    expect(s.workbench.shell.getRegionState(region).open).toBe(true);
    expect(s.workbench.layout.listPanelInstances(region)).toHaveLength(1);
    s.controller.dispose();
  });
}
