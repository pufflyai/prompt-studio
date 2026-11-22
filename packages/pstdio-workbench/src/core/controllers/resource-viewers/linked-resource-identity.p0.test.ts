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

test.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])("hydrating a linked page retains Main before replay (tabs: %s, another owner: %s)", (tabs, anotherOwner) => {
  const { w } = createResourceViewerFixture({ tabs });
  const link = { type: "record", id: "x" };
  expect(w.pageLocations.navigate({ kind: "page", page: viewerPage("reader"), resource: link, open: "pin" }).ok).toBe(
    true,
  );
  const current = () => (tabs ? w.layout.getActivePanel("main") : w.pages.getContent());
  const previous = current()!;
  const previousId = tabs ? w.layout.getActivePanel("main")!.instanceId : w.pages.getContent()!.widgetId;
  const host = viewerHostKey(w, previousId);
  const captured = w.viewers.captureContext(previous.placementIdentity!);
  const resolved = { ...viewerResource("x"), label: "Current title", metadata: { writable: true } };
  if (anotherOwner)
    w.pages.registerPage({
      ...w.pages.getPage("reader")!,
      id: "other-owner-reader",
      ref: { kind: "page", extensionId: "another.owner", id: "reader" },
      path: "other-owner-reader",
      resource: { kinds: [{ kind: "resource-kind", extensionId: "another.owner", id: "record" }] },
      panelView: undefined,
    });
  w.pages.refreshResource({ ...resolved, extensionId: "another.owner" });
  w.pages.refreshResource({ ...resolved, projectId: "another-project" });
  expect(current()?.resource).toEqual(link);
  w.pages.refreshResource(resolved);
  expect(current()?.resource).toMatchObject({ id: "x", label: "Current title", metadata: { writable: true } });
  expect(tabs ? w.layout.getActivePanel("main")?.instanceId : w.pages.getContent()?.widgetId).toBe(previousId);
  expect(captured.isViewerCurrent?.()).toBe(true);
  const location = w.pages.store.getState().location!;
  expect(w.pageLocations.replay({ ...location, resource: resolved }).ok).toBe(true);
  const currentId = tabs ? w.layout.getActivePanel("main")?.instanceId : w.pages.getContent()?.widgetId;
  expect(currentId).toBe(previousId);
  expect(viewerHostKey(w, currentId!)).toBe(host);
  expect(captured.isViewerCurrent?.()).toBe(true);
  expect(current()?.resource).toEqual(resolved);
  w.dispose();
});

test("hydration uses each page slot's declared owner for a bare reference", () => {
  const { w } = createResourceViewerFixture();
  w.pages.registerPage({
    ...w.pages.getPage("reader")!,
    id: "paired",
    ref: viewerPage("paired"),
    path: "paired",
    slots: [
      {
        id: "other",
        region: "side",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", extensionId: "another.owner", id: "record" }],
            view: { kind: "view", id: "reader" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  const link = { type: "record", id: "x" };
  expect(w.pageLocations.navigate({ kind: "page", page: viewerPage("paired"), resource: link }).ok).toBe(true);
  w.pages.openSlot({ pageId: "paired", slotId: "other", resource: link, open: "pin" });
  const mainId = w.pages.getContent()?.widgetId;
  const sideId = w.layout.getActivePanel("side")?.instanceId;
  w.pages.refreshResource({ ...viewerResource("x"), label: "Main owner" });
  expect(w.pages.getContent()?.resource?.label).toBe("Main owner");
  expect(w.layout.getActivePanel("side")?.resource).toEqual(link);
  w.pages.refreshResource({ ...viewerResource("x"), extensionId: "another.owner", label: "Side owner" });
  expect(w.pages.getContent()?.resource?.label).toBe("Main owner");
  expect(w.layout.getActivePanel("side")?.resource?.label).toBe("Side owner");
  expect(w.pages.getContent()?.widgetId).toBe(mainId);
  expect(w.layout.getActivePanel("side")?.instanceId).toBe(sideId);
  w.dispose();
});

test("replaying a resolved link retains its many-resource follower and host", () => {
  const { w } = createResourceViewerFixture();
  try {
    w.views.registerView({ id: "follower", title: "Follower", body: { kind: "react", render: () => null } });
    w.pages.registerPage({
      ...w.pages.getPage("reader")!,
      id: "paired",
      ref: viewerPage("paired"),
      path: "paired",
      panelView: undefined,
      slots: [
        {
          id: "follower",
          region: "side",
          openOn: "page-resource",
          item: {
            kind: "binding",
            binding: {
              kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }],
              view: { kind: "view", id: "follower" },
              cardinality: "many",
            },
          },
        },
      ],
    });
    expect(
      w.pageLocations.navigate({ kind: "page", page: viewerPage("paired"), resource: { type: "record", id: "x" } }).ok,
    ).toBe(true);
    const main = w.pages.getContent()!;
    const follower = w.layout.getActivePanel("side")!;
    expect(follower.placementIdentity).toMatchObject({ kind: "page", pageId: "paired", slotId: "follower" });
    const host = viewerHostKey(w, follower.instanceId);
    const location = w.pages.store.getState().location!;
    expect(w.pageLocations.replay({ ...location, resource: viewerResource("x") })).toMatchObject({ ok: true });
    expect(w.pages.getContent()?.widgetId).toBe(main.widgetId);
    expect(w.layout.listPanelInstances("side")).toHaveLength(1);
    expect(w.layout.getActivePanel("side")?.instanceId).toBe(follower.instanceId);
    expect(w.layout.getActivePanel("side")?.resource).toEqual(viewerResource("x"));
    expect(viewerHostKey(w, follower.instanceId)).toBe(host);
  } finally {
    w.dispose();
  }
});
