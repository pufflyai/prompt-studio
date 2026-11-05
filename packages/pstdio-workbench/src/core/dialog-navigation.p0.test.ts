import { expect, test } from "bun:test";
import { createWorkbench } from "./workbench-core";

const setup = () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  const page = { kind: "page" as const, id: "home", extensionId: "acme.tools" };
  workbench.pages.registerPage({
    id: "home",
    ref: page,
    title: "Home",
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    slots: [],
  });
  const dialog = { kind: "page" as const, id: "form", extensionId: "acme.tools" };
  const registration = workbench.pages.registerPage({
    id: "form",
    ref: dialog,
    title: "Create item",
    path: "form",
    modeId: "project",
    params: { name: { type: "string" } },
    main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.setProject("p1");
  workbench.pageLocations.navigate({ kind: "page", page });
  return { workbench, dialog, registration };
};
test("a dialog opens its page view with independent parameters and preserves Main and route on close", async () => {
  const { workbench, dialog } = setup();
  const before = workbench.pages.store.getState();
  const main = workbench.layout.getLayout().regions.main.widgets;
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog, params: { name: "First" } });
  const placement = workbench.layout.getLayout().regions.overlay.widgets[0]!;
  expect(placement?.pageContext).toMatchObject({ page: dialog, params: { name: "First" } });
  expect(workbench.pages.store.getState().location).toEqual(before.location);
  expect(workbench.layout.getLayout().regions.main.widgets).toEqual(main);
  workbench.layout.closePanel(placement.widgetId);
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
  expect(workbench.pages.store.getState().location).toEqual(before.location);
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog, params: { name: "Second" } });
  expect(workbench.layout.getLayout().regions.overlay.widgets[0]?.pageContext?.params).toEqual({ name: "Second" });
});
test("dialog views are removed with their contributing page", async () => {
  const { workbench, dialog, registration } = setup();
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog });
  registration.dispose();
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
  await expect(workbench.navigation.openTarget({ kind: "dialog", page: dialog })).rejects.toThrow();
});
test("a dialog cannot carry the previous project's form into another project", async () => {
  const { workbench, dialog } = setup();
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog, params: { name: "Private draft" } });
  workbench.pageLocations.switchProject("p2");
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
});
test("dialog resources cannot bind a different project's services", async () => {
  const { workbench, dialog } = setup();
  await expect(
    workbench.navigation.openTarget({
      kind: "dialog",
      page: dialog,
      resource: { type: "folder", id: "one", projectId: "p2" },
    }),
  ).rejects.toThrow("another project");
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
});
