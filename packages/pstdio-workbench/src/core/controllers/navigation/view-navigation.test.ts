import { expect, test } from "bun:test";
import { createWindowingFixture } from "../../../examples/windowing/fixture";
import { windowingExtensionId, windowingPages } from "../../../examples/windowing/resources";
import { openWorkbenchView } from "./view-navigation";

test("explicit view open uses the current page Main binding", () => {
  const fixture = createWindowingFixture();
  const core = fixture.workbench;
  core.pageLocations.navigate({
    kind: "page",
    page: windowingPages.notes,
    resource: fixture.resources.notes[0],
    open: "pin",
  });
  openWorkbenchView(core, { viewId: "windowing.note", resource: fixture.resources.notes[1]!, open: "pin" });
  expect(core.layout.getLayout().regions.main.widgets.map((tab) => tab.resource?.id)).toEqual(["note-a", "note-b"]);
  expect(core.pages.store.getState().location?.resource?.id).toBe("note-b");
});

test("explicit view open uses the page binding before the view's mode default", () => {
  const fixture = createWindowingFixture();
  const core = fixture.workbench;
  core.views.getView("windowing.session")!.defaultPanel = "side";
  core.pages.registerPage({
    id: "session-owner",
    ref: { kind: "page", extensionId: windowingExtensionId, id: "session-owner" },
    path: "session-owner",
    modeId: "windowing",
    main: { kind: "view", view: { kind: "view", id: "windowing.files" }, cardinality: "one" },
    slots: [
      {
        id: "session",
        region: "bottom",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "windowing.session" }],
            view: { kind: "view", id: "windowing.session" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  core.pageLocations.navigate({
    kind: "page",
    page: { kind: "page", extensionId: windowingExtensionId, id: "session-owner" },
  });
  openWorkbenchView(core, { viewId: "windowing.session", resource: fixture.resources.sessions[0], open: "pin" });
  expect(core.layout.getLayout().regions.bottom.widgets.some((tab) => tab.resource?.id === "session-1")).toBe(true);
  expect(core.layout.getLayout().regions.side.widgets).toHaveLength(0);
});

test("explicit view open reuses a moved editor before its default destination", async () => {
  const fixture = createWindowingFixture();
  const core = fixture.workbench;
  core.views.getView("windowing.session")!.defaultPanel = "side";
  await core.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
    resource: fixture.resources.sessions[0],
    open: "pin",
  });
  const original = core.layout.getLayout().regions.side.widgets.find((tab) => tab.resource?.id === "session-1")!;
  core.movePanel(original.widgetId, "secondary");
  core.pageLocations.navigate({ kind: "page", page: windowingPages.sessions });
  openWorkbenchView(core, { viewId: "windowing.session", resource: fixture.resources.sessions[0], open: "pin" });
  const tabs = Object.values(core.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .filter((tab) => tab.resource?.id === "session-1");
  expect(tabs).toHaveLength(1);
  expect(tabs[0]!.widgetId).toBe(original.widgetId);
  expect(core.layout.getLayout().regions.secondary.activeWidgetId).toBe(original.widgetId);
});

test("a view default never falls back to another mode panel or bypasses its policy", () => {
  const fixture = createWindowingFixture();
  const core = fixture.workbench;
  core.views.getView("windowing.session")!.defaultPanel = "secondary";
  const before = core.layout.getLayout();
  expect(() =>
    openWorkbenchView(core, { viewId: "windowing.session", resource: fixture.resources.sessions[0] }),
  ).toThrow("destination");
  expect(core.layout.getLayout()).toBe(before);
  core.views.getView("windowing.session")!.defaultPanel = "side";
  core.shell.setRegionOpen("side", false);
  core.modes.getMode("windowing")!.regionSettings = { side: { canOpen: false } };
  expect(() =>
    openWorkbenchView(core, { viewId: "windowing.session", resource: fixture.resources.sessions[0] }),
  ).toThrow("cannot open");
});
