import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { page, resource } from "./placement-lifecycle-test-support";

test("closing an auxiliary tab selects a remaining tab in its region", () => {
  const w = createWorkbench();
  for (const id of ["page-a", "page-b", "aux"])
    w.layout.registerPanel({ id, title: id, rendererId: "noop", region: id === "aux" ? "side" : "main" });
  const a = w.layout.openWidget("page-a", { role: "location", resource: resource("a"), tabRetention: "persistent" });
  w.movePanel(a.widgetId, "side");
  w.layout.openWidget("page-b", { role: "location", resource: resource("b"), tabRetention: "persistent" });
  const aux = w.layout.openWidget("aux", { role: "sub-panel", resource: resource("aux"), closable: true });
  w.layout.closePanel(aux.widgetId);
  expect(w.layout.getLayout().regions.side.activeWidgetId).toBe(a.widgetId);
  expect(w.layout.getActivePanel()?.instanceId).toBe(a.widgetId);
  expect(w.layout.getLayout().activeLocationWidgetId).toBe(a.widgetId);
});

test("closing a tab in an inactive region preserves the active page resource", () => {
  const w = createWorkbench();
  for (const id of ["page-a", "page-b", "aux"])
    w.layout.registerPanel({ id, title: id, rendererId: "noop", region: id === "aux" ? "side" : "main" });
  const a = w.layout.openWidget("page-a", { role: "location", resource: resource("a"), tabRetention: "persistent" });
  w.movePanel(a.widgetId, "side");
  const b = w.layout.openWidget("page-b", { role: "location", resource: resource("b"), tabRetention: "persistent" });
  const aux = w.layout.openWidget("aux", { role: "sub-panel", resource: resource("aux"), closable: true });
  w.layout.activatePanel(b.widgetId);
  w.layout.closePanel(aux.widgetId);
  expect(w.layout.getLayout().regions.side.activeWidgetId).toBe(a.widgetId);
  expect(w.layout.getLayout().activeWidgetId).toBe(b.widgetId);
  expect(w.layout.getLayout().activeLocationWidgetId).toBe(b.widgetId);
});

test("a pinned page resource stays in its chosen region when another resource opens", async () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "edit", activate() {} });
  w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "workspace",
    ref: page("workspace"),
    path: "workspace",
    modeId: "edit",
    main: { kind: "panels", empty: { kind: "view", id: "editor" } },
    slots: [],
  });
  w.pages.registerPage({
    id: "docs",
    ref: page("docs"),
    parentId: "workspace",
    path: "docs",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  w.pageLocations.setProject("project");
  await w.navigation.openTarget({ kind: "page", page: page("docs"), resource: resource("a"), open: "pin" });
  const a = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(a.widgetId, "secondary");
  w.layout.registerPanel({ id: "derived", title: "Derived", rendererId: "noop", region: "secondary" });
  const derived = w.layout.openWidget("derived", { resource: resource("derived"), role: "content" });
  await w.navigation.openTarget({ kind: "page", page: page("docs"), resource: resource("b"), open: "pin" });
  expect(w.layout.getLayout().regions.secondary.widgets.map((tab) => tab.widgetId)).toContain(a.widgetId);
  expect(w.layout.getLayout().regions.secondary.widgets.map((tab) => tab.widgetId)).not.toContain(derived.widgetId);
});
