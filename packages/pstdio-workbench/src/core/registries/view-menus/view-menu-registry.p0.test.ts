import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "../layout/layout-model";
import { registerWorkbenchViewPlacement } from "../views/view-placement";
import { createViewRegistry } from "../views/view-registry";
import { createWorkbenchViewMenuRegistry, viewMenuPanelId } from "./view-menu-registry";

const createViews = () =>
  createViewRegistry({
    registerBody: () => ({ dispose() {} }),
  });

describe("Workbench View menus", () => {
  test("attaches View-backed menus to every placement of their owner View", () => {
    const layout = createLayoutModel();
    const views = createViews();
    const viewMenus = createWorkbenchViewMenuRegistry({ views });
    views.registerView({ id: "ticket.editor", title: "Ticket", body: { kind: "react", render: () => null } });
    views.registerView({
      id: "ticket.files",
      title: "Files",
      icon: "Files",
      body: { kind: "react", render: () => null },
    });
    viewMenus.registerViewMenu({
      id: "ticket.files-menu",
      ownerViewId: "ticket.editor",
      viewId: "ticket.files",
      side: "left",
    });

    const registration = registerWorkbenchViewPlacement(
      layout,
      views,
      {
        id: "ticket.page.editor",
        viewId: "ticket.editor",
        region: "main",
        role: "location",
        singleton: true,
        closable: false,
      },
      viewMenus,
    );

    const menuId = viewMenuPanelId("ticket.page.editor", "ticket.files-menu");
    expect(layout.getWidget("ticket.page.editor")?.ownedPanelMenuIds).toEqual([menuId]);
    expect(layout.getWidget(menuId)).toMatchObject({
      rendererId: "ticket.files",
      region: "main-left-menu",
      config: { viewContextId: "ticket.files-menu" },
    });

    registration.dispose();
    expect(layout.getWidget(menuId)).toBeUndefined();
  });
});
