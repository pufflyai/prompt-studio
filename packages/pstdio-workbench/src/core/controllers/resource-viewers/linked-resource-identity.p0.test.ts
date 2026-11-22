import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerPanel, viewerResource } from "./resource-viewer-test-fixture";
import { viewerHostKey } from "./viewer-host-continuity";

test("opening a resolved resource transfers the linked Main viewer before its reference is refreshed", async () => {
  const { w, openSide } = createResourceViewerFixture();
  expect(
    w.pageLocations.navigate({ kind: "page", page: viewerPage("reader"), resource: { type: "record", id: "x" } }).ok,
  ).toBe(true);
  await openSide("x");
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
  expect(w.pages.getContent()?.resource).toBeUndefined();
});

test("linked identity keeps projects, declared documents, and explicit owners distinct", () => {
  const { w } = createResourceViewerFixture({ document: true });
  const key = w.pages.resourceReferenceKey;
  const bare = { type: "record", id: "x" };
  expect(key(bare)).toBe(key(viewerResource("x")));
  expect(key(bare)).not.toBe(key({ ...viewerResource("x"), projectId: "another-project" }));
  expect(key(bare)).not.toBe(key({ ...viewerResource("x"), extensionId: "another.owner" }));
  expect(key({ ...bare, metadata: { document: "one" } })).not.toBe(key({ ...bare, metadata: { document: "two" } }));
});

test("another extension declaring the same local kind does not change an existing linked viewer's owner", async () => {
  const { w, openSide } = createResourceViewerFixture();
  expect(
    w.pageLocations.navigate({ kind: "page", page: viewerPage("reader"), resource: { type: "record", id: "x" } }).ok,
  ).toBe(true);
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "other-owner-reader",
    ref: { kind: "page", extensionId: "another.owner", id: "reader" },
    path: "other-owner-reader",
    resource: { kinds: [{ kind: "resource-kind", extensionId: "another.owner", id: "record" }] },
    panelView: undefined,
  });
  await openSide("x");
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
  expect(w.pages.getContent()?.resource).toBeUndefined();
});

test("ambiguous local kind names reuse only the explicitly declared panel owner", async () => {
  const { w } = createResourceViewerFixture();
  const other = { kind: "placement" as const, extensionId: "another.owner", id: "reader" };
  w.modePlacements.registerPlacement({
    id: "other-owner-reader",
    ref: other,
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", extensionId: "another.owner", id: "record" }],
        view: { kind: "view", id: "reader" },
        cardinality: "many",
      },
    },
  });
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "other-owner-reader",
    ref: { kind: "page", extensionId: "another.owner", id: "reader" },
    path: "other-owner-reader",
    resource: { kinds: [{ kind: "resource-kind", extensionId: "another.owner", id: "record" }] },
    panelView: other,
  });
  const link = { type: "record", id: "x" };
  await w.navigation.openPanel({ panel: viewerPanel, resource: link, region: "side", open: "pin" });
  const first = w.layout.getActivePanel("side")!;
  await w.navigation.openPanel({ panel: viewerPanel, resource: viewerResource("x"), region: "side", open: "pin" });
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
  expect(w.layout.getActivePanel("side")?.instanceId).toBe(first.instanceId);
  await w.navigation.openPanel({ panel: other, resource: link, region: "side", open: "pin" });
  expect(w.layout.listPanelInstances("side")).toHaveLength(2);
});

test("a linked Main viewer restores from its existing saved layout and still moves to Side", async () => {
  const original = createResourceViewerFixture({ tabs: true });
  const link = { type: "record", id: "x" };
  expect(
    original.w.pageLocations.navigate({ kind: "page", page: viewerPage("reader"), resource: link, open: "pin" }).ok,
  ).toBe(true);
  const identity = original.w.layout.getActivePanel("main")!.instanceId;
  const reopened = createResourceViewerFixture({
    tabs: true,
    saved: original.saved,
    locations: original.locations,
    boot: true,
  });
  expect(reopened.w.layout.getActivePanel("main")?.instanceId).toBe(identity);
  await reopened.openSide("x");
  expect(reopened.w.layout.listPanelInstances("main")).toHaveLength(0);
  expect(reopened.w.layout.listPanelInstances("side")).toHaveLength(1);
});

test.each([false, true])("resolving a linked reference retains its host and commands (Main tabs: %s)", (tabs) => {
  const { w } = createResourceViewerFixture({ tabs });
  expect(
    w.pageLocations.navigate({
      kind: "page",
      page: viewerPage("reader"),
      resource: { type: "record", id: "x" },
      open: "pin",
    }).ok,
  ).toBe(true);
  const current = () => (tabs ? w.layout.getActivePanel("main") : w.pages.getContent())!;
  const widgetId = () => (tabs ? w.layout.getActivePanel("main")!.instanceId : w.pages.getContent()!.widgetId);
  const previous = current();
  const previousId = widgetId();
  const host = viewerHostKey(w, previousId);
  const captured = w.viewers.captureContext(previous.placementIdentity!);
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "other-owner-reader",
    ref: { kind: "page", extensionId: "another.owner", id: "reader" },
    path: "other-owner-reader",
    resource: { kinds: [{ kind: "resource-kind", extensionId: "another.owner", id: "record" }] },
    panelView: undefined,
  });
  expect(w.viewers.refreshReference(viewerResource("x"), {})).toBe(true);
  expect(widgetId()).toBe(previousId);
  expect(viewerHostKey(w, widgetId())).toBe(host);
  expect(captured.isViewerCurrent?.()).toBe(true);
  expect(current().resource).toEqual(viewerResource("x"));
  if (tabs) {
    expect(w.layout.listPanelInstances("main")).toHaveLength(1);
    expect(current().tabRetention).toBe("persistent");
  }
});
