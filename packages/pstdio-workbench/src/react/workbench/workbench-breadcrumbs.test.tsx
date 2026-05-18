import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { buildWorkbenchBreadcrumbItems } from "./workbench-breadcrumbs";

describe("buildWorkbenchBreadcrumbItems", () => {
  test("adds a favorite context action for resource breadcrumbs", async () => {
    const workbench = createWorkbenchCore();
    const resource = {
      kind: "dashboard-view",
      uri: "pstdio://dashboard/tickets",
      label: "Tickets",
      metadata: {
        favoriteScope: { scope: "project", projectId: "project-1" },
      },
    };

    workbench.breadcrumbs.setItems([{ title: "Tickets", icon: "Table", resource }]);

    const [item] = buildWorkbenchBreadcrumbItems(workbench);
    const action = item?.contextMenuActions?.[0];

    expect(action).toMatchObject({ key: "favorites.addBreadcrumbResource", label: "Add to Favorites" });

    await action?.onClick();

    await expect(workbench.favorites.isFavorited(resource, { scope: "project", projectId: "project-1" })).resolves.toBe(
      true,
    );

    await action?.onClick();

    await expect(workbench.favorites.list({ scope: "project", projectId: "project-1" })).resolves.toHaveLength(1);
  });

  test("does not add favorite actions for plain breadcrumbs", () => {
    const workbench = createWorkbenchCore();

    workbench.breadcrumbs.setItems([{ title: "Plain" }]);

    const [item] = buildWorkbenchBreadcrumbItems(workbench);

    expect(item?.contextMenuActions).toBeUndefined();
  });
});
