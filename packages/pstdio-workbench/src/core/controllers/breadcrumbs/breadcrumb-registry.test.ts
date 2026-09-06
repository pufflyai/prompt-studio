import { describe, expect, test } from "bun:test";
import { createWorkbenchBreadcrumbController } from "./breadcrumb-registry";

describe("createWorkbenchBreadcrumbController", () => {
  test("owns one disposable breadcrumb contribution", () => {
    const breadcrumbs = createWorkbenchBreadcrumbController();
    const first = [{ title: "Tickets" }];
    const second = [{ title: "Tickets" }, { title: "PS-326" }];

    const firstHandle = breadcrumbs.setItems(first);
    const secondHandle = breadcrumbs.setItems(second);
    firstHandle.dispose();

    expect(breadcrumbs.getItems()).toBe(second);
    secondHandle.dispose();
    expect(breadcrumbs.getItems()).toBeUndefined();
  });
});
