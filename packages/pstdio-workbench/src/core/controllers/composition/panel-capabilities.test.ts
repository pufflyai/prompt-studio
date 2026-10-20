import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { harness, navigate, openFile, page, panel, resource } from "./placement-lifecycle-test-support";

for (const region of ["side", "secondary"] as const) {
  test(`${region} rejects navigation and tab drops before changing layout`, async () => {
    const w = harness();
    await w.navigation.openTarget(navigate("alpha"));
    await w.navigation.openTarget({ kind: "panel", panel, resource: resource("one"), open: "pin" });
    const tab = w.layout.getActivePanel("side")!;
    w.modes.getMode("edit")!.regionSettings = { [region]: { acceptsTabs: false } };
    const before = w.layout.getLayout();
    expect(w.getPanelDestinations(tab.instanceId)).not.toContain(region);
    expect(() => w.movePanel(tab.instanceId, region)).toThrow("cannot move");
    await expect(w.navigation.openTarget({ kind: "panel", panel, region, resource: resource("two") })).rejects.toThrow(
      "accept tabs",
    );
    expect(w.layout.getLayout()).toBe(before);
  });
}

test("compound navigation cannot reveal a forbidden panel or publish part of the page change", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  w.shell.setRegionOpen("side", false);
  w.modes.getMode("edit")!.regionSettings = { side: { canOpen: false } };
  const before = w.layout.getLayout();
  await expect(
    w.navigation.openTarget({
      kind: "compound",
      targets: [navigate("beta"), { kind: "panel", panel, resource: resource("two") }],
    }),
  ).rejects.toThrow("cannot open");
  expect(w.layout.getLayout()).toBe(before);
  expect(w.pages.store.getState().location?.resource?.id).toBe("alpha");
});

test("reused tabs cannot move into a forbidden destination, but existing tabs remain usable", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  const target = { kind: "panel", panel, resource: resource("one"), open: "pin" } as const;
  await w.navigation.openTarget(target);
  w.modes.getMode("edit")!.regionSettings = { secondary: { acceptsTabs: false }, side: { acceptsTabs: false } };
  const before = w.layout.getLayout();
  await expect(w.navigation.openTarget({ ...target, region: "secondary" })).rejects.toThrow("accept tabs");
  expect(w.layout.getLayout()).toBe(before);
  await w.navigation.openTarget(target);
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("one");
});

test("a single page panel open enforces the destination policy", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  w.modes.getMode("edit")!.regionSettings = { secondary: { acceptsTabs: false } };
  const before = w.layout.getLayout();
  await expect(
    w.navigation.openTarget({
      kind: "panel",
      panel: { kind: "page-slot", page: { kind: "page", extensionId: "test", id: "workspace" }, id: "files" },
      region: "secondary",
      resource: resource("one"),
    }),
  ).rejects.toThrow("accept tabs");
  expect(w.layout.getLayout()).toBe(before);
});

test("compound navigation reuses the incoming page's existing Main tabs", async () => {
  const w = harness();
  w.modes.registerMode({ id: "other", activate() {} });
  w.pages.registerPage({
    id: "other",
    ref: page("other"),
    path: "other",
    modeId: "other",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ ...openFile("one"), open: "pin" });
  w.modes.getMode("edit")!.regionSettings = { main: { acceptsTabs: false } };
  await w.navigation.openTarget({ kind: "page", page: page("other") });
  await w.navigation.openTarget({ kind: "compound", targets: [navigate("alpha"), openFile("one")] });
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("one");
  await expect(w.navigation.openTarget(openFile("two"))).rejects.toThrow("accept tabs");
});

test("revisiting a moved Main tab uses its actual destination", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  const target = { kind: "panel", panel, resource: resource("one"), open: "pin" } as const;
  await w.navigation.openTarget(target);
  w.movePanel(w.layout.getActivePanel("side")!.instanceId, "main");
  w.modes.getMode("edit")!.regionSettings = { side: { acceptsTabs: false } };
  await w.navigation.openTarget(target);
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("one");
});

test("compound navigation restores a moved Main tab's saved destination", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  const target = { kind: "panel", panel, resource: resource("one"), open: "pin" } as const;
  await w.navigation.openTarget(target);
  w.movePanel(w.layout.getActivePanel("side")!.instanceId, "main");
  await w.navigation.openTarget(navigate("beta"));
  w.modes.getMode("edit")!.regionSettings = { side: { acceptsTabs: false } };
  await w.navigation.openTarget({ kind: "compound", targets: [navigate("alpha"), target] });
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("one");
});

test("closing the final tab collapses an optional panel and preserves a nonclosing surface", async () => {
  for (const canClose of [true, false]) {
    const w = harness();
    await w.navigation.openTarget(navigate("alpha"));
    w.modes.getMode("edit")!.regionSettings = { side: { canClose } };
    await w.navigation.openTarget({ kind: "panel", panel, resource: resource("one"), open: "pin" });
    w.closePlacement(w.layout.getActivePanel("side")!.placementIdentity!);
    expect(w.layout.listPanelInstances("side")).toEqual([]);
    expect(w.shell.getRegionState("side").open).toBe(!canClose);
  }
});

test("reset clears header choices read from persisted layout", async () => {
  const saved = new Map();
  const initial = harness().layout.getLayout();
  initial.regions.side.headerVisible = true;
  saved.set(undefined, initial);
  const w = harness(saved);
  w.modes.getMode("edit")!.regionSettings = { side: { showHeader: false } };
  await w.navigation.openTarget(navigate("alpha"));
  w.shell.setHeaderVisible("side", true);
  w.resetPanelLayout();
  expect(w.layout.getLayout().regions.side.headerVisible).toBeUndefined();
  expect(w.shell.getPanelPolicy("side").showHeader).toBe(false);
});

test("compound navigation inherits host permissions in the proposed mode", async () => {
  const w = createWorkbench({ initialSidePanelMode: "closed", regionSettings: { side: { canOpen: false } } });
  w.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  for (const id of ["a", "b"]) {
    w.modes.registerMode({ id, activate() {} });
    w.pages.registerPage({
      id,
      ref: { kind: "page", id, extensionId: "test" },
      path: id,
      modeId: id,
      main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
      slots: [],
    });
  }
  w.shellPlacements.registerPlacement({
    id: "tool",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "view" }, presence: "closed" },
  });
  w.pageLocations.setProject("project");
  await w.navigation.openTarget({ kind: "page", page: { kind: "page", extensionId: "test", id: "a" } });
  const before = w.layout.getLayout();
  await expect(
    w.navigation.openTarget({
      kind: "compound",
      targets: [
        { kind: "page", page: { kind: "page", extensionId: "test", id: "b" } },
        { kind: "panel", panel: { kind: "shell-placement", id: "tool" } },
      ],
    }),
  ).rejects.toThrow("cannot open");
  expect(w.pages.store.getState().activePageId).toBe("a");
  expect(w.layout.getLayout()).toBe(before);
});

test("compound navigation checks the incoming mode's saved visibility", async () => {
  const w = createWorkbench({ initialSidePanelMode: "closed" });
  w.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  for (const id of ["a", "b"]) {
    w.modes.registerMode({ id, activate() {}, regionSettings: id === "b" ? { side: { canOpen: false } } : undefined });
    w.pages.registerPage({
      id,
      ref: { kind: "page", id, extensionId: "test" },
      path: id,
      modeId: id,
      main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
      slots: [],
    });
  }
  w.shellPlacements.registerPlacement({
    id: "tool",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "view" }, presence: "closed" },
  });
  w.pageLocations.setProject("project");
  const target = (id: string) => ({ kind: "page" as const, page: { kind: "page" as const, extensionId: "test", id } });
  await w.navigation.openTarget(target("b"));
  await w.navigation.openTarget(target("a"));
  w.shell.setRegionOpen("side", true);
  const before = w.layout.getLayout();
  await expect(
    w.navigation.openTarget({
      kind: "compound",
      targets: [target("b"), { kind: "panel", panel: { kind: "shell-placement", id: "tool" } }],
    }),
  ).rejects.toThrow("cannot open");
  expect(w.pages.store.getState().activePageId).toBe("a");
  expect(w.layout.getLayout()).toBe(before);
});
