import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const tickets = { kind: "page", extensionId: "test", id: "tickets" } as const;
const ticket = { kind: "page", extensionId: "test", id: "ticket" } as const;
const resource = { type: "ticket", id: "one", label: "Ticket 1" };

test.each([
  "aside",
  "bottom",
] as const)("moving a routed editor into page %s preserves its page and resource", async (destination) => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
  for (const id of ["tickets", "details", "inspector"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "tickets",
    ref: tickets,
    path: "tickets",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "tickets" } },
    slots: [],
  });
  w.pages.registerPage({
    id: "ticket",
    ref: ticket,
    path: "ticket",
    parentId: "tickets",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "ticket" }] },
    main: { kind: "view", view: { kind: "view", id: "details" }, cardinality: "one" },
    panelMenus: { right: { view: { kind: "view", id: "inspector" } } },
    slots: [
      {
        id: "auxiliary",
        region: destination === "aside" ? "bottom" : "aside",
        item: { kind: "view", view: { kind: "view", id: "inspector" }, presence: "open" },
      },
    ],
  });
  w.pageLocations.setProject("project");
  await w.navigation.openTarget({ kind: "page", page: ticket, resource });
  const editor = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(editor.widgetId, destination);
  expect(w.pages.store.getState().location).toMatchObject({ page: ticket, resource });
  expect(w.getPrimaryResource()).toMatchObject(resource);
  expect(w.layout.getLayout().regions[destination].widgets[0]).toMatchObject({
    widgetId: editor.widgetId,
    resource,
    viewId: "details",
  });
  expect(w.layout.getLayout().regions["main-right-menu"].widgets[0]).toMatchObject({ resource });
  const auxiliaryRegion = destination === "aside" ? "bottom" : "aside";
  const auxiliary = w.layout.getLayout().regions[auxiliaryRegion].widgets[0]!;
  w.movePanel(auxiliary.widgetId, "secondary");
  expect(w.pages.store.getState().location).toMatchObject({ page: ticket, resource });
  expect(w.getPrimaryResource()).toMatchObject(resource);
  await w.navigation.openTarget({ kind: "page", page: ticket, resource: { ...resource, id: "two" } });
  await w.navigation.openTarget({ kind: "page", page: ticket, resource });
  expect(w.layout.getLayout().regions[destination].widgets[0]?.widgetId).toBe(editor.widgetId);
  expect(w.layout.getLayout().regions.main.widgets).toEqual([]);
  w.movePanel(editor.widgetId, "side");
  expect(w.pages.store.getState().location).toMatchObject({ page: tickets });
  expect(w.pages.store.getState().location?.resource).toBeUndefined();
  expect(w.layout.getLayout().regions.side.widgets[0]).toMatchObject({ widgetId: editor.widgetId, resource });
  await w.dispose();
});
