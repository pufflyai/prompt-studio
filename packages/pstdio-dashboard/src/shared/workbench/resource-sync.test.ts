import { expect, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench/core";
import { setResourceBreadcrumb } from "./resource-sync";

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
