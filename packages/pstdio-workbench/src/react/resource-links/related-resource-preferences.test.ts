import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../core";
import { createLocalStorageWorkbenchPersistence } from "../../storage/local-storage-persistence";
import { opening, ref, setup } from "./related-resource-openings.fixture";

const setupPage = (region: "side" | "secondary") => {
  const layouts = new Map<string | undefined, WorkbenchLayout>();
  const s = setup([opening("default", region)], {
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
        kinds: [{ kind: "resource-kind", id: "session" }],
        cardinality: "many",
      },
    },
  });
  s.setResolver(async (resource) => [opening(resource.id === "source" ? "default" : "other-default", region)]);
  const visit = async (id: string) => {
    const resource = ref("document", id);
    s.workbench.pageLocations.navigate(s.target(resource));
    await s.controller.open(resource);
  };
  return { ...s, visit };
};

test.each(["side", "secondary"] as const)("returning to a resource restores its chosen %s preview", async (region) => {
  const s = setupPage(region);
  await s.controller.open(s.source);
  s.workbench.shellPlacements.openPlacement({
    placementId: "manual",
    resource: ref("session", "chosen"),
    open: "preview",
  });
  await s.visit("other");
  expect(s.workbench.layout.getActivePanel(region)?.resource?.id).toBe("other-default");
  await s.visit("source");
  expect(s.workbench.layout.getActivePanel(region)?.resource?.id).toBe("chosen");
  expect(s.workbench.layout.listPanelInstances(region).filter((p) => p.tabRetention === "preview")).toHaveLength(1);
  s.controller.dispose();
});

test("manual closures survive workbench reloads", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const create = () =>
    setup([opening("default")], createLocalStorageWorkbenchPersistence({ namespace: "choices", storage }));
  const first = create();
  await first.controller.open(first.source);
  first.workbench.shell.setRegionOpen("side", false);
  first.controller.dispose();
  const second = create();
  await second.controller.open(second.source);
  expect(second.workbench.shell.getRegionState("side").open).toBe(false);
  second.controller.dispose();
});

test("untouched defaults remain available after controller teardown and reload", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const create = () =>
    setup([opening("default")], createLocalStorageWorkbenchPersistence({ namespace: "defaults", storage }));
  const first = create();
  await first.controller.open(first.source);
  first.controller.dispose();
  const second = create();
  await second.controller.open(second.source);
  expect(second.workbench.layout.getActivePanel("side")?.resource?.id).toBe("default");
  second.controller.dispose();
});

test("closing a background automatic tab keeps the user's selected pin on return", async () => {
  const s = setupPage("side");
  await s.controller.open(s.source);
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("session", "chosen"), open: "pin" });
  const background = s.workbench.layout.listPanelInstances("side").find((p) => p.resource?.id === "default")!;
  s.workbench.closePlacement(background.placementIdentity!);
  await s.visit("other");
  await s.visit("source");
  expect(s.workbench.layout.getActivePanel("side")?.resource?.id).toBe("chosen");
  expect(s.workbench.layout.listPanelInstances("side").some((p) => p.resource?.id === "default")).toBe(false);
  s.controller.dispose();
});

test("a manual panel closure cancels an in-flight related opening", async () => {
  const s = setupPage("side");
  s.workbench.shell.setRegionOpen("side", true);
  let finish!: (entries: ReturnType<typeof opening>[]) => void;
  s.setResolver(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = s.controller.open(s.source);
  s.workbench.shell.setRegionOpen("side", false);
  finish([opening("late")]);
  await pending;
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  expect(s.workbench.layout.listPanelInstances("side")).toHaveLength(0);
  s.controller.dispose();
});

test.each([
  "side",
  "secondary",
] as const)("returning to a resource restores its selected pinned %s tab", async (region) => {
  const s = setupPage(region);
  await s.controller.open(s.source);
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("session", "chosen"), open: "pin" });
  await s.visit("other");
  s.workbench.shellPlacements.openPlacement({
    placementId: "manual",
    resource: ref("session", "elsewhere"),
    open: "pin",
  });
  await s.visit("source");
  expect(s.workbench.layout.getActivePanel(region)?.resource?.id).toBe("chosen");
  expect(s.workbench.layout.getActivePanel(region)?.tabRetention).toBe("persistent");
  s.controller.dispose();
});

test.each([
  "side",
  "secondary",
] as const)("a manually closed %s preview stays closed on resource return", async (region) => {
  const s = setupPage(region);
  await s.controller.open(s.source);
  s.workbench.closePlacement(s.workbench.layout.getActivePanel(region)!.placementIdentity!);
  await s.visit("other");
  expect(s.workbench.shell.getRegionState(region).open).toBe(true);
  await s.visit("source");
  expect(s.workbench.shell.getRegionState(region).open).toBe(false);
  s.controller.dispose();
});

test.each([
  "side",
  "secondary",
] as const)("a manually hidden %s panel stays hidden on resource return", async (region) => {
  const s = setupPage(region);
  await s.controller.open(s.source);
  s.workbench.shell.setRegionOpen(region, false);
  await s.visit("other");
  await s.visit("source");
  expect(s.workbench.shell.getRegionState(region).open).toBe(false);
  s.controller.dispose();
});

test.each([
  "side",
  "secondary",
] as const)("automatic %s cleanup does not become a manual closure preference", async (region) => {
  const s = setupPage(region);
  await s.controller.open(s.source);
  await s.visit("other");
  await s.visit("source");
  expect(s.workbench.shell.getRegionState(region).open).toBe(true);
  expect(s.workbench.layout.getActivePanel(region)?.resource?.id).toBe("default");
  s.controller.dispose();
});
