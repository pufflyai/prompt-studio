import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerPanel, viewerResource } from "./resource-viewer-test-fixture";

for (const operation of ["switch", "replace"] as const) {
  test(`${operation} to the current Main resource keeps its tab and updates its reference`, async () => {
    const { w, openMain } = createResourceViewerFixture({ tabs: true });
    await openMain("x");
    const before = w.layout.getActivePanel("main")!;
    expect(
      w.viewers.change(before.placementIdentity!, {
        operation,
        from: viewerResource("x"),
        resource: { ...viewerResource("x"), label: "Renamed" },
        position: { line: 7 },
      }),
    ).toBe("changed");
    expect(w.layout.listPanelInstances("main")).toHaveLength(1);
    expect(w.layout.getActivePanel("main")).toMatchObject({
      instanceId: before.instanceId,
      resource: { label: "Renamed" },
      position: { line: 7 },
      tabRetention: "persistent",
    });
  });
}

for (const tabs of [false, true]) {
  test(`a captured completion is stale after its viewer closes and reopens (Main tabs: ${tabs})`, async () => {
    const { w, openMain, openSide, side } = createResourceViewerFixture({ tabs });
    await (tabs ? openMain("draft", "draft") : openSide("draft", "draft"));
    const before = tabs ? w.layout.getActivePanel("main")! : side();
    const complete = w.viewers.capture(before.placementIdentity!)!;
    w.closePlacement(before.placementIdentity!);
    await (tabs ? openMain("draft", "draft") : openSide("draft", "draft"));
    expect(complete({ operation: "replace", resource: viewerResource("created") })).toBe("stale");
    expect((tabs ? w.layout.getActivePanel("main")! : side()).resource?.id).toBe("draft");
  });
}

test("capturing a viewer survives pinning and moving it", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("draft", "draft");
  const before = side();
  const complete = w.viewers.capture(before.placementIdentity!)!;
  w.pinPlacement(before.placementIdentity!, false);
  w.movePanel(before.instanceId, "secondary");
  expect(complete({ operation: "replace", resource: viewerResource("created") })).toBe("changed");
  expect(w.layout.getActivePanel("secondary")?.resource?.id).toBe("created");
});

for (const kind of ["page", "panel"] as const) {
  test(`a ${kind} opening pins its reused preview without moving it`, async () => {
    const { w, side } = createResourceViewerFixture();
    await w.navigation.openPanel({
      panel: viewerPanel,
      resource: viewerResource("x"),
      region: "side",
      open: "preview",
    });
    const before = side();
    await w.navigation.openTarget(
      kind === "page"
        ? { kind, page: viewerPage("reader"), resource: viewerResource("x"), open: "pin" }
        : { kind, panel: viewerPanel, resource: viewerResource("x"), open: "pin", region: "main" },
    );
    expect(side()).toMatchObject({ instanceId: before.instanceId, tabRetention: "persistent" });
    await w.navigation.openPanel({
      panel: viewerPanel,
      resource: viewerResource("y"),
      region: "side",
      open: "preview",
    });
    expect(
      w.layout
        .listPanelInstances("side")
        .map((panel) => panel.resource?.id)
        .sort(),
    ).toEqual(["x", "y"]);
  });
}

for (const operation of ["close", "switch"] as const) {
  test(`a captured completion sees an intermediate ${operation} inside a batched command`, async () => {
    const { batchWorkbenchChanges } = await import("../../shared/store/workbench-batch");
    const { w, openSide, side } = createResourceViewerFixture();
    await openSide("draft", "draft");
    const identity = side().placementIdentity!;
    const complete = w.viewers.capture(identity)!;
    batchWorkbenchChanges(() => {
      if (operation === "close") {
        w.closePlacement(identity);
        w.modePlacements.openPlacement({ panel: viewerPanel, resource: viewerResource("draft", "draft"), open: "pin" });
      } else {
        w.viewers.change(identity, {
          operation: "switch",
          from: viewerResource("draft", "draft"),
          resource: viewerResource("other"),
        });
        w.viewers.change(identity, {
          operation: "switch",
          from: viewerResource("other"),
          resource: viewerResource("draft", "draft"),
        });
      }
    });
    expect(complete({ operation: "replace", resource: viewerResource("created") })).toBe("stale");
    expect(side().resource?.id).toBe("draft");
  });
}

test("compound navigation pins a reused Main preview before leaving its page", async () => {
  const { w } = createResourceViewerFixture({ tabs: true });
  await w.navigation.openPage({ page: viewerPage("reader"), resource: viewerResource("x"), open: "preview" });
  await w.navigation.openTarget({
    kind: "compound",
    targets: [
      { kind: "page", page: viewerPage("reader"), resource: viewerResource("x"), open: "pin" },
      { kind: "page", page: viewerPage("other") },
    ],
  });
  await w.navigation.openPage({ page: viewerPage("reader"), intent: "restore" });
  expect(w.layout.getActivePanel("main")).toMatchObject({ resource: { id: "x" }, tabRetention: "persistent" });
});

test("a compound page opening reuses a one-cardinality viewer with pin intent", async () => {
  const { w, side } = createResourceViewerFixture({ viewerCardinality: "one", tabs: true });
  w.modePlacements.openPlacement({ panel: viewerPanel, resource: viewerResource("x") });
  await w.navigation.openTarget({
    kind: "compound",
    targets: [{ kind: "page", page: viewerPage("reader"), resource: viewerResource("x"), open: "pin" }],
  });
  expect(side()).toMatchObject({ resource: { id: "x" }, tabRetention: "persistent" });
});

test("compound pinning preserves a moved primary viewer on another page", async () => {
  const { w, openMain, side, other } = createResourceViewerFixture({ tabs: true });
  await openMain("x");
  const caller = w.layout.getActivePanel("main")!;
  w.pinPlacement(caller.placementIdentity!, false);
  w.movePanel(caller.instanceId, "side");
  other();
  const location = w.pages.store.getState().location;
  await w.navigation.openTarget({
    kind: "compound",
    targets: [{ kind: "page", page: viewerPage("reader"), resource: viewerResource("x"), open: "pin" }],
  });
  expect(side()).toMatchObject({ instanceId: caller.instanceId, tabRetention: "persistent" });
  expect(w.pages.store.getState().location).toBe(location);
});
