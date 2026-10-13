import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const page = (id: string) => ({ kind: "page" as const, extensionId: "test", id });

test("explicit navigation opens a new tab when returning to a saved empty page", async () => {
  const core = createWorkbench();
  core.modes.registerMode({ id: "mode", activate() {} });
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  core.pages.registerPage({
    id: "notes",
    ref: page("notes"),
    path: "notes",
    modeId: "mode",
    main: { kind: "panels", empty: { kind: "view", id: "view" } },
    slots: [
      {
        id: "note",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "note" }],
            view: { kind: "view", id: "view" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  core.pages.registerPage({
    id: "other",
    ref: page("other"),
    path: "other",
    modeId: "mode",
    main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
    slots: [],
  });
  core.pageLocations.setProject("project");
  await core.navigation.openTarget({ kind: "page", page: page("notes") });
  await core.navigation.openTarget({ kind: "page", page: page("other") });
  const resource = { type: "note", id: "new", label: "New note" };
  await core.navigation.openTarget({
    kind: "compound",
    targets: [
      { kind: "page", page: page("notes") },
      { kind: "panel", panel: { kind: "page-slot", page: page("notes"), id: "note" }, resource, open: "pin" },
    ],
  });
  expect(core.layout.getLayout().regions.main.widgets).toHaveLength(1);
  expect(core.layout.getLayout().regions.main.widgets[0]?.resource).toEqual(resource);
  expect(core.layout.getLayout().activeWidgetId).toBe(core.layout.getLayout().regions.main.widgets[0]?.widgetId);
  await core.dispose();
});

test("one-cardinality page resource changes keep the live widget identity", async () => {
  const core = createWorkbench();
  core.modes.registerMode({ id: "mode", activate() {} });
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  core.pages.registerPage({
    id: "home",
    ref: page("home"),
    path: "home",
    modeId: "mode",
    main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
    slots: [],
  });
  core.pages.registerPage({
    id: "resource",
    ref: page("resource"),
    path: "resource",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "track" }] },
    modeId: "mode",
    main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
    slots: [],
  });
  core.pageLocations.setProject("project");
  await core.navigation.openTarget({ kind: "page", page: page("resource"), resource: { type: "track", id: "a" } });
  const original = core.layout.getLayout().regions.main.widgets[0]!;
  core.shell.setHeaderVisible("main", false);
  await core.navigation.openTarget({ kind: "page", page: page("resource"), resource: { type: "track", id: "b" } });
  const rebound = core.layout.getLayout().regions.main.widgets[0]!;
  expect(rebound.placementIdentity).toEqual(original.placementIdentity);
  expect(rebound.widgetId).toBe(original.widgetId);
  expect(rebound.resource?.id).toBe("b");
  expect(core.shell.getPanelPolicy("main").showHeader).toBe(true);
  core.movePanel(rebound.widgetId, "secondary");
  await core.navigation.openTarget({ kind: "page", page: page("resource"), resource: { type: "track", id: "c" } });
  expect(core.layout.getLayout().regions.secondary.widgets[0]?.widgetId).toBe(original.widgetId);
  expect(core.layout.getLayout().regions.secondary.widgets[0]?.resource?.id).toBe("b");
  expect(core.layout.getLayout().regions.main.widgets[0]?.widgetId).not.toBe(original.widgetId);
  expect(core.layout.getLayout().regions.main.widgets[0]?.resource?.id).toBe("c");
  await core.dispose();
});
