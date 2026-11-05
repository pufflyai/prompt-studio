import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

test("only the active page extension can update its params", () => {
  const workbench = createWorkbench();
  const page = { kind: "page" as const, id: "board", extensionId: "acme.a" };
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "board", title: "Board", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "board",
    ref: page,
    path: "board",
    modeId: "project",
    params: { range: { type: "string", default: "now-1h" } },
    main: { kind: "view", view: { kind: "view", id: "board" }, cardinality: "one" },
    slots: [],
  });
  const owner = createWorkbenchWebviewHostCapabilities({ workbench, extensionId: "acme.a" });
  const other = createWorkbenchWebviewHostCapabilities({ workbench, extensionId: "acme.b" });
  expect(() => owner["page.params.update"]({ params: {} })).toThrow("page_params_no_page");
  workbench.pageLocations.setProject("p1");
  workbench.pageLocations.navigate({ kind: "page", page });
  const location = workbench.pages.store.getState().location;
  expect(() => other["page.params.update"]({ params: { range: "now-6h" } })).toThrow("page_params_not_owner");
  expect(workbench.pages.store.getState().location).toBe(location);
  expect(owner["page.params.update"]({ params: { range: "now-6h" } })).toMatchObject({
    location: { params: { range: "now-6h" } },
  });
});

test("dialog params belong to the calling form and cannot update the page behind it", async () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  const home = { kind: "page" as const, id: "home", extensionId: "acme.home" };
  const dialog = { kind: "page" as const, id: "dialog", extensionId: "acme.form" };
  for (const page of [home, dialog])
    workbench.pages.registerPage({
      id: page.id,
      ref: page,
      path: page.id,
      modeId: "project",
      params: { name: { type: "string", default: "New" } },
      main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
      slots: [],
    });
  workbench.pageLocations.setProject("p1");
  workbench.pageLocations.navigate({ kind: "page", page: home, params: { name: "Main" } });
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog, params: { name: "Draft" } });
  const widget = workbench.layout.getLayout().regions.overlay.widgets[0]!;
  const placement = { ...widget, panelId: widget.contributionId, instanceId: widget.widgetId, closable: true };
  const owner = createWorkbenchWebviewHostCapabilities({
    workbench,
    placement,
    projectId: "p1",
    extensionId: "acme.form",
  });
  const other = createWorkbenchWebviewHostCapabilities({
    workbench,
    placement,
    projectId: "p1",
    extensionId: "acme.home",
  });
  expect(() => other["page.params.update"]({ params: { name: "Wrong" } })).toThrow("page_params_not_owner");
  expect(owner["page.params.update"]({ params: { name: "Edited" } })).toMatchObject({
    location: { page: dialog, params: { name: "Edited" } },
  });
  expect(workbench.pages.store.getState().location).toMatchObject({ page: home, params: { name: "Main" } });
  expect(() => owner["page.params.update"]({ params: { invalid: true } })).toThrow("page_param_invalid");
  expect(owner["page.params.update"]({ params: { name: null } })).toMatchObject({
    location: { page: dialog, params: undefined },
  });
  workbench.layout.closePanel(widget.widgetId);
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog });
  expect(() => owner["page.params.update"]({ params: { name: "Stale" } })).toThrow("no longer open");
});
