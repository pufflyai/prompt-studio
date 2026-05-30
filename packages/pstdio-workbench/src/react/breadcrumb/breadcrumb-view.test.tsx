import { describe, expect, test } from "bun:test";
import { buildWorkbenchBreadcrumbItems } from "./breadcrumb-view";

describe("buildWorkbenchBreadcrumbItems", () => {
  test("does not add context actions for resource breadcrumbs", () => {
    const resource = {
      kind: "dashboard-view",
      uri: "pstdio://dashboard/tickets",
      label: "Tickets",
    };

    const items = [{ title: "Tickets", icon: "Table", resource }];

    const [item] = buildWorkbenchBreadcrumbItems(items);

    expect("contextMenuActions" in (item ?? {})).toBe(false);
  });

  test("keeps plain breadcrumbs action-free", () => {
    const items = [{ title: "Plain" }];

    const [item] = buildWorkbenchBreadcrumbItems(items);

    expect("contextMenuActions" in (item ?? {})).toBe(false);
  });
});
