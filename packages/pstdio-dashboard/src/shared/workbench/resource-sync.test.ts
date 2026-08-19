import { expect, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { setResourceBreadcrumb, updateResourceBreadcrumbLabel } from "./resource-sync";

test("derives a breadcrumb with one hierarchy walk", () => {
  const workbench = createWorkbenchCore();
  const resource = {
    kind: "ticket",
    uri: "dashboard-workbench://ticket/PS-173",
    id: "PS-173",
    label: "PS-173 Resource hierarchy",
  } satisfies ResourceRef;
  const originalWalkHierarchy = workbench.resources.walkHierarchy;
  let walkCount = 0;
  workbench.resources.walkHierarchy = (selectedResource) => {
    walkCount += 1;
    return originalWalkHierarchy(selectedResource);
  };

  setResourceBreadcrumb(workbench, resource);

  expect(walkCount).toBe(1);
  expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["PS-173 Resource hierarchy"]);
});

test("a label-only refresh keeps the breadcrumb trail", () => {
  const workbench = createWorkbenchCore();
  const root = {
    kind: "extension-view",
    uri: "dashboard-workbench://project/p1/extension-views/pstdio-planner.tickets",
    id: "pstdio-planner.tickets",
    label: "Tickets",
  } satisfies ResourceRef;
  const ticket = {
    kind: "ticket",
    uri: "dashboard-workbench://ticket/PS-1",
    id: "PS-1",
    label: "PS-1 Old title",
  } satisfies ResourceRef;
  workbench.breadcrumbs.setItems([
    { title: root.label, resource: root },
    { title: ticket.label, resource: ticket },
  ]);

  updateResourceBreadcrumbLabel(workbench, { ...ticket, label: "PS-1 New title" });

  expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Tickets", "PS-1 New title"]);
});

test("a label refresh for another resource rebuilds the breadcrumb", () => {
  const workbench = createWorkbenchCore();
  const other = {
    kind: "ticket",
    uri: "dashboard-workbench://ticket/PS-9",
    id: "PS-9",
    label: "PS-9 Something else",
  } satisfies ResourceRef;
  workbench.breadcrumbs.setItems([{ title: "Stale", resource: other }]);

  const ticket = {
    kind: "ticket",
    uri: "dashboard-workbench://ticket/PS-1",
    id: "PS-1",
    label: "PS-1 Fresh",
  } satisfies ResourceRef;
  updateResourceBreadcrumbLabel(workbench, ticket);

  expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["PS-1 Fresh"]);
});
