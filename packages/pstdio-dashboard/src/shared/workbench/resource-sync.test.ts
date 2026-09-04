import { expect, test } from "bun:test";
import type { PageRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type ResourceRef } from "@pstdio/workbench";
import { setResourceBreadcrumb, updateResourceBreadcrumbLabel } from "./resource-sync";

const ticketsPage = {
  extensionId: "pstdio.planner",
  kind: "page",
  id: "tickets",
} satisfies PageRef;
const ticketPage = {
  extensionId: "pstdio.planner",
  kind: "page",
  id: "ticket",
} satisfies PageRef;

const createHarness = () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({
    id: "tickets-view",
    title: "Tickets",
    body: { kind: "react", render: () => null },
  });
  workbench.views.registerView({
    id: "ticket-view",
    title: "Ticket",
    body: { kind: "react", render: () => null },
  });
  workbench.pages.registerPage({
    id: "pstdio.planner.page.tickets",
    ref: ticketsPage,
    title: "Tickets",
    path: "tickets",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "tickets-view" }],
  });
  workbench.pages.registerPage({
    id: "pstdio.planner.page.ticket",
    ref: ticketPage,
    title: "Ticket",
    path: "tickets/:id",
    modeId: "project",
    parentId: "pstdio.planner.page.tickets",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKinds: ["ticket"], viewId: "ticket-view", cardinality: "one" },
      },
    ],
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({
    kind: "page",
    page: ticketPage,
    resource: { type: "ticket", id: "PS-1", label: "PS-1 Old title" },
    parent: { kind: "page", page: ticketsPage },
  });
  return workbench;
};

test("updates the current page resource through its canonical location", () => {
  const workbench = createHarness();
  const resource = {
    kind: "ticket",
    uri: "pstdio://extension-resource/ticket/PS-1",
    id: "PS-1",
    label: "PS-1 New title",
  } satisfies ResourceRef;

  setResourceBreadcrumb(workbench, resource);

  expect(workbench.pages.store.getState().location).toMatchObject({
    page: ticketPage,
    resource: { type: "ticket", id: "PS-1", label: "PS-1 New title" },
    parent: { page: ticketsPage },
  });
});

test("a label refresh keeps the canonical parent breadcrumb", () => {
  const workbench = createHarness();
  const resource = {
    kind: "ticket",
    uri: "pstdio://extension-resource/ticket/PS-1",
    id: "PS-1",
    label: "PS-1 New title",
  } satisfies ResourceRef;

  updateResourceBreadcrumbLabel(workbench, resource);

  expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Tickets", "PS-1 New title"]);
});
