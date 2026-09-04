import { describe, expect, test } from "bun:test";
import type { NavigationTargetPage, PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { createWorkbenchBreadcrumbController } from "../breadcrumbs/breadcrumb-registry";
import { createWorkbenchPageBreadcrumbItems, setWorkbenchPageBreadcrumbs } from "./page-breadcrumbs";

const resources = {
  normalize: (resource: { type: string; id: string; label?: string }) => ({ ...resource }),
  toUri: (resource: { type: string; id: string }) => `pstdio://${resource.type}/${resource.id}`,
  fromUri: () => undefined,
};

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
      resources,
      navigate: (target) => targets.push(target),
    });

    expect(items.map((item) => item.title)).toEqual(["Tickets", "PS-326 Additive pages"]);
    expect(items.at(-1)?.resource).toMatchObject({
      kind: "ticket",
      uri: "pstdio://ticket/PS-326",
      id: "PS-326",
      label: "PS-326 Additive pages",
    });
    items[0]?.onClick?.();
    expect(targets).toEqual([{ kind: "page", page: tickets.ref }]);
    expect(items[1]?.onClick).toBeUndefined();
  });

  test("uses only canonical page locations for contextual resource ancestry", () => {
    const tickets = page("tickets", "Tickets");
    const ticket = { ...page("ticket", "Ticket"), parentId: tickets.id };
    const child = { type: "ticket", id: "PS-2", label: "PS-2 Child" };
    const location: PageLocation = {
      page: ticket.ref,
      resource: child,
      parent: {
        page: ticket.ref,
        resource: { type: "ticket", id: "PS-1", label: "PS-1 Root" },
        parent: { page: tickets.ref },
      },
    };
    const targets: NavigationTargetPage[] = [];
    const breadcrumbs = createWorkbenchBreadcrumbController();

    setWorkbenchPageBreadcrumbs({
      breadcrumbs,
      location,
      pages: [tickets, ticket],
      resources,
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
      parent: { kind: "page", page: tickets.ref },
    });
    expect(items?.at(-1)?.onClick).toBeUndefined();
  });
});
