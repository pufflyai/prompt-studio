import { describe, expect, test } from "bun:test";
import type { NavigationTargetPage, PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { createResourceRegistry } from "../../registries/resources/resource-registry";
import { createViewRegistry } from "../../registries/views/view-registry";
import { createWorkbenchBreadcrumbController } from "../breadcrumbs/breadcrumb-registry";
import { defaultPageResourceCodec } from "../page-runtime/page-runtime";
import { createWorkbenchPageBreadcrumbItems, setWorkbenchPageBreadcrumbs } from "./page-breadcrumbs";

const page = (id: string, title: string): WorkbenchPageContribution => ({
  id,
  ref: { extensionId: "planner", kind: "page", id },
  title,
  path: id,
  modeId: "project",
  slots: [],
});

describe("page breadcrumbs", () => {
  test("derives one trail from the canonical parent chain", () => {
    const tickets = page("tickets", "Tickets");
    const ticket = { ...page("ticket", "Ticket"), parentId: tickets.id };
    const location: PageLocation = {
      page: ticket.ref,
      resource: { type: "ticket", id: "PS-326", label: "PS-326 Additive pages" },
      parent: { page: tickets.ref },
    };
    const targets: NavigationTargetPage[] = [];

    const items = createWorkbenchPageBreadcrumbItems({
      location,
      pages: [tickets, ticket],
      navigate: (target) => targets.push(target),
    });

    expect(items.map((item) => item.title)).toEqual(["Tickets", "PS-326 Additive pages"]);
    items[0]?.onClick?.();
    expect(targets).toEqual([{ kind: "page", page: tickets.ref }]);
    expect(items[1]?.onClick).toBeUndefined();
  });

  test("keeps the canonical page parent and appends the resource hierarchy", () => {
    const tickets = page("tickets", "Tickets");
    const ticket = { ...page("ticket", "Ticket"), parentId: tickets.id };
    const root = {
      kind: "ticket",
      uri: "pstdio://extension-resource/ticket/PS-1",
      id: "PS-1",
      label: "PS-1 Root",
    };
    const child = { type: "ticket", id: "PS-2", label: "PS-2 Child" };
    const location: PageLocation = {
      page: ticket.ref,
      resource: child,
      parent: { page: tickets.ref },
    };
    const targets: NavigationTargetPage[] = [];
    const resources = createResourceRegistry();
    const views = createViewRegistry({ getPanel: () => ({}), openPanel: () => ({}) as never });
    views.registerView({ id: "planner.tickets", panelId: "tickets", title: "Tickets" });
    resources.registerHierarchyProvider({
      id: "ticket-hierarchy",
      canResolve: (resource) => resource.kind === "ticket",
      getParent: (resource) => (resource.id === child.id ? root : { type: "view", viewId: "planner.tickets" }),
    });
    const breadcrumbs = createWorkbenchBreadcrumbController();

    setWorkbenchPageBreadcrumbs({
      breadcrumbs,
      location,
      pages: [tickets, ticket],
      pageResources: defaultPageResourceCodec,
      resources,
      views,
      navigate: (target) => targets.push(target),
    });

    const items = breadcrumbs.getItems();
    expect(items?.map((item) => item.title)).toEqual(["Tickets", "PS-1 Root", "PS-2 Child"]);
    items?.[0]?.onClick?.();
    expect(targets).toEqual([{ kind: "page", page: tickets.ref }]);
    items?.[1]?.onClick?.();
    expect(targets.at(-1)).toEqual({
      kind: "page",
      page: ticket.ref,
      resource: { type: "ticket", id: "PS-1", label: "PS-1 Root" },
    });
    expect(items?.at(-1)?.resource).toEqual({
      kind: "ticket",
      uri: "pstdio://extension-resource/ticket/PS-2",
      id: "PS-2",
      label: "PS-2 Child",
      metadata: undefined,
    });
  });
});
