import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { createDefaultWorkbenchLayout, type WorkbenchWidgetPlacement } from "../layout/layout-types";
import { resolvePageActivePlacement, resolvePageBreadcrumbPlacement } from "./page-active-placement";
import type { WorkbenchPageContribution } from "./page-registry-types";

const page: WorkbenchPageContribution = {
  id: "notes",
  ref: { kind: "page", id: "notes" },
  modeId: "project",
  path: "notes",
  main: { kind: "panels", empty: { kind: "view", id: "empty" } },
  slots: [],
};
const tab = (id: string) =>
  ({
    widgetId: id,
    contributionId: id,
    resource: { type: "note", id },
    placementIdentity: { kind: "page", pageId: "notes", slotId: "notes", instanceKey: id },
  }) satisfies WorkbenchWidgetPlacement;

test("page document selection stays with Main when an auxiliary panel has focus", () => {
  const layout = createDefaultWorkbenchLayout();
  const document = tab("document");
  layout.regions.main.widgets = [document];
  layout.regions.main.activeWidgetId = document.widgetId;
  for (const region of ["side", "secondary"] as const) {
    const auxiliary = tab(region);
    layout.regions[region].widgets = [auxiliary];
    layout.regions[region].activeWidgetId = auxiliary.widgetId;
    layout.activeWidgetId = auxiliary.widgetId;
    expect(resolvePageActivePlacement(layout, page)).toBe(document);
  }
});

test("a page without a selected Main document has no document context", () => {
  const layout = createDefaultWorkbenchLayout();
  const auxiliary = tab("inspector");
  layout.regions.side.widgets = [auxiliary];
  layout.regions.side.activeWidgetId = auxiliary.widgetId;
  layout.activeWidgetId = auxiliary.widgetId;
  expect(resolvePageActivePlacement(layout, page)).toBeUndefined();
});

test("a routed resource view exposes its placement presentation to breadcrumbs", () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", label: "Project", activate() {} });
  workbench.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  const page = {
    id: "note",
    ref: { kind: "page" as const, id: "note", extensionId: "test" },
    path: "note",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind" as const, id: "note" }] },
    parentId: "notes",
    main: { kind: "view" as const, view: { kind: "view" as const, id: "editor" }, cardinality: "one" as const },
    slots: [],
  };
  workbench.layout.getLayout().regions.main.widgets.push({
    widgetId: "note-b",
    contributionId: "editor",
    resource: { type: "note", id: "b" },
    placementIdentity: { kind: "page", pageId: "note", slotId: "$main", instanceKey: "one" },
  });
  expect(resolvePageActivePlacement(workbench.layout.getLayout(), page)?.resource?.id).toBe("b");
  expect(
    resolvePageBreadcrumbPlacement(workbench.layout.getLayout(), page, { type: "note", id: "b" })?.resource?.id,
  ).toBe("b");
});

test("a related Main document cannot replace the routed resource's breadcrumb actions", () => {
  const layout = createDefaultWorkbenchLayout();
  const related = tab("related");
  layout.regions.main.widgets = [related];
  layout.regions.main.activeWidgetId = related.widgetId;
  const resourcePage = { ...page, resource: { kinds: [{ kind: "resource-kind" as const, id: "note" }] } };
  expect(resolvePageBreadcrumbPlacement(layout, resourcePage, { type: "note", id: "source" })).toBeUndefined();
});
