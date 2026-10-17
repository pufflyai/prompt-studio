import { expect, test } from "bun:test";
import type { WorkbenchLayout, WorkbenchModuleContext } from "../../core";
import { opening, ref, setup } from "./related-resource-openings.fixture";
import { registerRelatedResourcePreviews } from "./related-resource-previews";

for (const region of ["side", "secondary"] as const) {
  for (const close of ["panel", "last-tab"] as const) {
    test(`closing a manual ${region} ${close} elsewhere stays closed when returning`, async () => {
      const layouts = new Map<string | undefined, WorkbenchLayout>();
      const relatedRegion = region === "side" ? "secondary" : "side";
      const s = setup([opening("related", relatedRegion)], {
        layoutPersistence: {
          getLayout: (scope) => layouts.get(scope),
          setLayout: (layout, scope) => layouts.set(scope, structuredClone(layout)),
        },
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
            kinds: [{ kind: "resource-kind", id: "terminal" }],
            cardinality: "many",
          },
        },
      });
      await s.controller.open(s.source);
      s.workbench.shellPlacements.openPlacement({
        placementId: "manual",
        resource: ref("terminal", "manual"),
        open: "pin",
      });
      s.workbench.shell.setRegionOpen(region, true);
      const panel = s.workbench.layout.getActivePanel(region)!;
      const home = { kind: "page" as const, page: { kind: "page" as const, id: "home", extensionId: "example" } };
      s.workbench.pageLocations.navigate(home);
      expect(s.workbench.shell.getRegionState(region).open).toBe(true);
      if (close === "panel") s.workbench.shell.setRegionOpen(region, false);
      else s.workbench.closePlacement(panel.placementIdentity!);
      s.workbench.pageLocations.navigate(s.target(s.source));
      await s.controller.open(s.source);
      expect(s.workbench.shell.getRegionState(region).open).toBe(false);
      expect(s.workbench.layout.listPanelInstances(region)).toHaveLength(close === "panel" ? 1 : 0);
      expect(s.workbench.layout.getActivePanel(relatedRegion)?.resource?.id).toBe("related");
      s.controller.dispose();
    });
  }
}

test("a resource's current related openings decide which saved choices apply", async () => {
  const s = setup([opening("related", "secondary")], {
    resolvePagePersistenceScope: ({ resource, pageId }) => ({
      scope: resource?.id ?? pageId,
      carryRegions: ["side", "secondary"],
    }),
  });
  await s.controller.open(s.source);
  s.workbench.shell.setRegionOpen("secondary", true);
  s.workbench.pinPlacement(s.workbench.layout.getActivePanel("secondary")!.placementIdentity!, true);
  s.workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "home", extensionId: "example" } });
  s.workbench.shell.setRegionOpen("secondary", false);
  s.setResolver(async () => []);
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  expect(s.workbench.shell.getRegionState("secondary").open).toBe(false);
  s.controller.dispose();
});

test("manual related-panel closures after saved-route boot are remembered", async () => {
  const s = setup([opening("related")], {
    resolvePagePersistenceScope: ({ resource, pageId }) => ({
      scope: resource?.id ?? pageId,
      carryRegions: ["side", "secondary"],
    }),
  });
  s.workbench.shellPlacements.registerPlacement({
    id: "native",
    region: "side",
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
  s.workbench.pinPlacement(s.workbench.layout.getActivePanel("side")!.placementIdentity!, true);
  s.controller.dispose();
  const controller = registerRelatedResourcePreviews(s.workbench as WorkbenchModuleContext, {
    canonicalize: (resource) => resource,
    createService: () => s.service,
  });
  s.workbench.pageLocations.clearProject();
  s.workbench.pageLocations.boot("project");
  await Bun.sleep(0);
  expect(s.workbench.shell.getRegionState("side").open).toBe(true);
  s.workbench.shell.setRegionOpen("side", false);
  s.workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "home", extensionId: "example" } });
  s.workbench.pageLocations.navigate(s.target(s.source));
  await controller.open(s.source);
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  controller.dispose();
});

test("a closure during the first owner lookup is remembered only for its related destination", async () => {
  const s = setup([], {
    resolvePagePersistenceScope: ({ resource, pageId }) => ({
      scope: resource?.id ?? pageId,
      carryRegions: ["side", "secondary"],
    }),
  });
  s.workbench.shell.setRegionOpen("side", true);
  s.workbench.shell.setRegionOpen("secondary", true);
  const result = Promise.withResolvers<ReturnType<typeof opening>[]>();
  s.setResolver(() => result.promise);
  const pending = s.controller.open(s.source);
  s.workbench.shell.setRegionOpen("side", false);
  s.workbench.shell.setRegionOpen("secondary", false);
  result.resolve([opening("related")]);
  await pending;
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  s.setResolver(async () => [opening("related")]);
  s.workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "home", extensionId: "example" } });
  s.workbench.shell.setRegionOpen("secondary", true);
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  expect(s.workbench.shell.getRegionState("secondary").open).toBe(true);
  s.controller.dispose();
});

test("a session chosen during lookup returns without taking selection from another pinned tab", async () => {
  const s = setup([], {
    resolvePagePersistenceScope: ({ resource, pageId }) => ({
      scope: resource?.id ?? pageId,
      carryRegions: ["side", "secondary"],
    }),
  });
  s.workbench.shellPlacements.registerPlacement({
    id: "manual",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "session" }],
        cardinality: "many",
      },
    },
  });
  const result = Promise.withResolvers<ReturnType<typeof opening>[]>();
  s.setResolver(() => result.promise);
  const pending = s.controller.open(s.source);
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("session", "chosen"), open: "pin" });
  s.workbench.shell.setRegionOpen("side", true);
  result.resolve([opening("default")]);
  await pending;
  s.setResolver(async () => [opening("default")]);
  s.workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "home", extensionId: "example" } });
  s.workbench.shellPlacements.openPlacement({
    placementId: "manual",
    resource: ref("session", "elsewhere"),
    open: "pin",
  });
  s.workbench.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("elsewhere");
  expect(s.workbench.layout.listPanelInstances("side").some((p) => p.resource?.id === "chosen")).toBe(true);
  s.controller.dispose();
});
