import { expect, test } from "bun:test";
import { createResourceViewerFixture } from "../resource-viewers/resource-viewer-test-fixture";

test("reopen latest tab restores closed conversations in reverse order in their panel", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("one");
  await w.closePlacement(side().placementIdentity!);
  await openSide("two");
  await w.closePlacement(side().placementIdentity!);
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(side()?.resource?.id).toBe("two");
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(side()?.resource?.id).toBe("one");
});

test("reopen restores a Main resource tab after navigating elsewhere", async () => {
  const { w, openMain, other } = createResourceViewerFixture({ tabs: true });
  await openMain("note");
  const tab = w.layout.getActivePanel("main")!;
  await w.closePlacement(tab.placementIdentity!);
  other();
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("note");
});

test("reopen restores a detached page tab after navigating away", async () => {
  const { w, openMain, other, side } = createResourceViewerFixture({ tabs: true });
  await openMain("detached");
  w.movePanel(w.layout.getActivePanel("main")!.instanceId, "side");
  other();
  await w.closePlacement(side().placementIdentity!);
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(side()?.resource?.id).toBe("detached");
});

test("reopen restores a static page slot as a persistent tab", async () => {
  const { w } = createResourceViewerFixture();
  const page = { kind: "page", extensionId: "example.readers", id: "static" } as const;
  w.pages.registerPage({
    id: "static",
    ref: page,
    path: "static",
    modeId: "project",
    main: { kind: "panels" },
    slots: [
      { id: "tool", region: "main", item: { kind: "view", view: { kind: "view", id: "reader" }, presence: "open" } },
    ],
  });
  await w.navigation.openPage({ page });
  await w.closePlacement(w.layout.getActivePanel("main")!.placementIdentity!);
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(w.layout.getActivePanel("main")).toMatchObject({ pinned: true, tabRetention: "persistent" });
});

test("reopen preserves the owning workspace when a detached slot shows a file", async () => {
  const { harness, navigate, openFile } = await import("./placement-lifecycle-test-support");
  const w = harness();
  await w.navigation.openPage(navigate("workspace-one"));
  await w.navigation.openPanel({ ...openFile("file"), open: "pin" });
  w.movePanel(w.layout.getActivePanel("main")!.instanceId, "side");
  await w.navigation.openPage(navigate("workspace-two"));
  await w.closePlacement(w.layout.getActivePanel("side")!.placementIdentity!);
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("file");
  expect(w.pages.store.getState().location?.resource?.id).toBe("workspace-one");
});

test("reopen supports single-instance resource slots", async () => {
  const { w } = createResourceViewerFixture();
  const page = { kind: "page", extensionId: "example.readers", id: "single" } as const;
  w.pages.registerPage({
    id: "single",
    ref: page,
    path: "single",
    modeId: "project",
    main: { kind: "panels" },
    slots: [
      {
        id: "tool",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "record" }],
            view: { kind: "view", id: "reader" },
            cardinality: "one",
          },
        },
      },
    ],
  });
  await w.navigation.openPage({ page });
  w.pages.openSlot({ pageId: "single", slotId: "tool", resource: { type: "record", id: "one" } });
  await w.closePlacement(w.layout.getActivePanel("main")!.placementIdentity!);
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("one");
});

test("a restored detached file reopens in its original workspace", async () => {
  const { harness, navigate, openFile } = await import("./placement-lifecycle-test-support");
  const saved = new Map();
  const first = harness(saved);
  await first.navigation.openPage(navigate("workspace-one"));
  await first.navigation.openPanel({ ...openFile("file"), open: "pin" });
  first.movePanel(first.layout.getActivePanel("main")!.instanceId, "side");
  await first.navigation.openPage(navigate("workspace-two"));
  const w = harness(saved);
  await w.navigation.openPage(navigate("workspace-two"));
  await w.closePlacement(w.layout.getActivePanel("side")!.placementIdentity!);
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("file");
  expect(w.pages.store.getState().location?.resource?.id).toBe("workspace-one");
});

test("single-instance mode tabs reopen without a multi-tab intent", async () => {
  const { viewerPanel, viewerResource } = await import("../resource-viewers/resource-viewer-test-fixture");
  const { w, side } = createResourceViewerFixture({ viewerCardinality: "one" });
  await w.navigation.openPanel({ panel: viewerPanel, resource: viewerResource("one"), region: "side" });
  await w.closePlacement(side().placementIdentity!);
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(side().resource?.id).toBe("one");
});

test("quick repeated reopening reserves distinct history entries", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  for (const id of ["one", "two"]) {
    await openSide(id);
    await w.closePlacement(side().placementIdentity!);
  }
  await Promise.all([
    w.commands.executeCommand("workbench.reopenClosedTab"),
    w.commands.executeCommand("workbench.reopenClosedTab"),
  ]);
  expect(
    w.layout
      .listPanelInstances("side")
      .map((tab) => tab.resource?.id)
      .sort(),
  ).toEqual(["one", "two"]);
});

test("quick reopening finishes each owning-page navigation before opening the next tab", async () => {
  const { w } = createResourceViewerFixture();
  for (const id of ["first", "second"]) {
    const page = { kind: "page", extensionId: "example.readers", id } as const;
    w.pages.registerPage({
      id,
      ref: page,
      path: id,
      modeId: "project",
      main: { kind: "panels" },
      slots: [
        {
          id: "tool",
          region: "main",
          item: { kind: "view", view: { kind: "view", id: "reader" }, presence: "open" },
        },
      ],
    });
    await w.navigation.openPage({ page });
    await w.closePlacement(w.layout.getActivePanel("main")!.placementIdentity!);
  }
  await Promise.all([
    w.commands.executeCommand("workbench.reopenClosedTab"),
    w.commands.executeCommand("workbench.reopenClosedTab"),
  ]);
  expect(w.pages.store.getState().activePageId).toBe("first");
  expect(w.layout.getActivePanel("main")?.placementIdentity).toMatchObject({ pageId: "first", slotId: "tool" });
});

test("a queued reopen cannot navigate another project and remains available in its original project", async () => {
  const { w } = createResourceViewerFixture();
  const page = { kind: "page", extensionId: "example.readers", id: "owned" } as const;
  w.pages.registerPage({
    id: "owned",
    ref: page,
    path: "owned",
    modeId: "project",
    main: { kind: "panels" },
    slots: [
      { id: "tool", region: "main", item: { kind: "view", view: { kind: "view", id: "reader" }, presence: "open" } },
    ],
  });
  await w.navigation.openPage({ page });
  await w.closePlacement(w.layout.getActivePanel("main")!.placementIdentity!);
  const pending = w.commands.executeCommand("workbench.reopenClosedTab");
  w.pageLocations.setProject("different-project");
  await expect(pending).rejects.toThrow("project");
  expect(w.pages.store.getState().activePageId).not.toBe("owned");
  expect(w.layout.getActivePanel("main")).toBeUndefined();
  w.pageLocations.setProject("project");
  await w.commands.executeCommand("workbench.reopenClosedTab");
  expect(w.pages.store.getState().activePageId).toBe("owned");
  expect(w.layout.getActivePanel("main")?.placementIdentity).toMatchObject({ pageId: "owned", slotId: "tool" });
});
