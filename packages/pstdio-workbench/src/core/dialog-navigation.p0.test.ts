import { expect, test } from "bun:test";
import { type Localizable, l10n } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "./registries/pages/page-registry";
import { createWorkbench } from "./workbench-core";

const setup = (
  title: Localizable = "Create item",
  options: Pick<WorkbenchPageContribution, "resource" | "parentId"> & { empty?: boolean } = {},
) => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  if (options.empty)
    workbench.views.registerView({
      id: "empty",
      title: "Choose resource",
      body: { kind: "react", render: () => null },
    });
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
    title,
    path: "form",
    modeId: "project",
    resource: options.resource,
    parentId: options.parentId,
    params: { name: { type: "string" } },
    main: {
      kind: "view",
      view: { kind: "view", id: "content" },
      cardinality: "one",
      presentation: "page",
      ...(options.empty ? { empty: { kind: "view" as const, id: "empty" } } : {}),
    },
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

test("dialog headings keep a localized page title instead of its shared view title", async () => {
  const { workbench, dialog } = setup(l10n("page.create", "Create workspace"));
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog });
  expect(workbench.layout.getLayout().regions.overlay.widgets[0]?.title).toBe("Create workspace");
});

test("dialogs preserve the resolved parent page context", async () => {
  const { workbench, dialog } = setup("Form", { parentId: "home" });
  const parent = workbench.pages.store.getState().location;
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog });
  expect(workbench.layout.getLayout().regions.overlay.widgets[0]?.pageContext?.parent).toEqual(parent);
});

test("dialog pages enforce routed resource constraints before opening an overlay", async () => {
  const { workbench, dialog } = setup("Resource form", {
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
  });
  await expect(workbench.navigation.openTarget({ kind: "dialog", page: dialog })).rejects.toThrow(
    "requires a resource",
  );
  await expect(
    workbench.navigation.openTarget({ kind: "dialog", page: dialog, resource: { type: "note", id: "wrong" } }),
  ).rejects.toThrow("does not accept resource kind");
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog, resource: { type: "workspace", id: "ok" } });
  expect(workbench.layout.getLayout().regions.overlay.widgets[0]?.resource).toMatchObject({
    type: "workspace",
    id: "ok",
  });
});

test("resource-free dialogs reject resources and an allowed empty resource dialog renders its empty view", async () => {
  const plain = setup();
  await expect(
    plain.workbench.navigation.openTarget({
      kind: "dialog",
      page: plain.dialog,
      resource: { type: "note", id: "wrong" },
    }),
  ).rejects.toThrow("does not accept a resource");
  const { workbench, dialog, registration } = setup("Empty form", {
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    empty: true,
  });
  await workbench.navigation.openTarget({ kind: "dialog", page: dialog });
  expect(workbench.layout.getLayout().regions.overlay.widgets[0]?.viewId).toBe("empty");
  registration.dispose();
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
});

test("a failed empty dialog registration rolls back its overlays and page placements before retry", () => {
  const { workbench, registration } = setup();
  const page = workbench.pages.getPage("form")!;
  registration.dispose();
  const overlays = workbench.overlays.listOverlays();
  const contribution: WorkbenchPageContribution = {
    ...page,
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: {
      kind: "view",
      view: { kind: "view", id: "content" },
      cardinality: "one",
      presentation: "page",
      empty: { kind: "view", id: "missing" },
    },
  };
  expect(() => workbench.pages.registerPage(contribution)).toThrow("not registered");
  expect(workbench.overlays.listOverlays()).toEqual(overlays);
  expect(workbench.pages.getPage("form")).toBeUndefined();
  workbench.views.registerView({
    id: "missing",
    title: "Choose resource",
    body: { kind: "react", render: () => null },
  });
  const retried = workbench.pages.registerPage(contribution);
  expect(workbench.pages.getPage("form")).toBeDefined();
  retried.dispose();
  expect(workbench.overlays.listOverlays()).toEqual(overlays);
});
