import { describe, expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { normalizeWorkbenchPageTarget } from "../page-location/page-location-normalization";
import { createWorkbenchPageBreadcrumbItems } from "./page-breadcrumb-projection";

const resources: WorkbenchPageResourceCodec = {
  normalize: (resource) => ({ ...resource, id: resource.id.toUpperCase() }),
  toUri: (resource) => `${resource.type}:${resource.id}`,
  fromUri: () => undefined,
};

const page = (input: {
  id: string;
  title: string;
  parentId?: string;
  extensionId?: string;
}): WorkbenchPageContribution => ({
  id: input.id,
  ref: { extensionId: input.extensionId ?? "pstdio", kind: "page", id: input.id },
  title: input.title,
  icon: `${input.id}-icon`,
  path: input.id,
  modeId: "project",
  ...(input.parentId ? { parentId: input.parentId } : {}),
  slots: [{ id: "content", role: "primary", region: "main", viewId: input.id }],
});

describe("createWorkbenchPageBreadcrumbItems", () => {
  test("navigates a contextual ancestor by its exact page location", () => {
    const pages = [
      page({ id: "start", title: "Start" }),
      page({ id: "tickets", title: "Tickets", parentId: "start", extensionId: "planner" }),
      page({ id: "ticket", title: "Ticket", parentId: "tickets", extensionId: "planner" }),
      page({ id: "workspaces", title: "Workspaces", parentId: "start" }),
    ];
    const location = normalizeWorkbenchPageTarget({
      target: {
        kind: "page",
        page: pages[3]!.ref,
        resource: { type: "workspace", id: "ws-4", label: "Workspace A" },
        parent: {
          kind: "page",
          page: pages[2]!.ref,
          resource: { type: "ticket", id: "ps-326", label: "PS-326" },
        },
      },
      pages,
      resources,
    }).location;
    const navigated: PageLocation[] = [];

    const items = createWorkbenchPageBreadcrumbItems({
      location,
      pages,
      resources,
      navigate: (target) => navigated.push(target),
    });

    expect(items.map((item) => item.title)).toEqual(["Start", "Tickets", "PS-326", "Workspace A"]);
    expect(items[2]?.location.resource).toEqual({ type: "ticket", id: "PS-326", label: "PS-326" });
    items[2]?.onClick?.();
    expect(navigated).toEqual([items[2]?.location]);
    expect(items.at(-1)?.onClick).toBeUndefined();
  });

  test("de-duplicates route targets without de-duplicating equal labels", () => {
    const pages = [
      page({ id: "sessions-a", title: "Sessions", extensionId: "one" }),
      page({ id: "tickets", title: "Tickets", extensionId: "planner" }),
      page({ id: "sessions-b", title: "Sessions", extensionId: "two" }),
      page({ id: "detail", title: "Detail", extensionId: "two" }),
    ];
    const sessionsA: PageLocation = { page: pages[0]!.ref };
    const tickets: PageLocation = { page: pages[1]!.ref, parent: sessionsA };
    const repeatedTickets: PageLocation = { page: pages[1]!.ref, parent: tickets };
    const sessionsB: PageLocation = { page: pages[2]!.ref, parent: repeatedTickets };
    const detail: PageLocation = { page: pages[3]!.ref, parent: sessionsB };

    const items = createWorkbenchPageBreadcrumbItems({
      location: detail,
      pages,
      resources,
      navigate: () => undefined,
    });

    expect(items.map((item) => item.title)).toEqual(["Sessions", "Tickets", "Sessions", "Detail"]);
    expect(items[0]?.routeKey).not.toBe(items[2]?.routeKey);
    expect(items.filter((item) => item.routeKey === items[1]?.routeKey)).toHaveLength(1);
  });

  test("uses declared page parents for a direct location", () => {
    const pages = [
      page({ id: "start", title: "Start" }),
      page({ id: "workspaces", title: "Workspaces", parentId: "start" }),
    ];
    const location = normalizeWorkbenchPageTarget({
      target: {
        kind: "page",
        page: pages[1]!.ref,
        resource: { type: "workspace", id: "ws-4", label: "Workspace A" },
      },
      pages,
      resources,
    }).location;

    const items = createWorkbenchPageBreadcrumbItems({
      location,
      pages,
      resources,
      navigate: () => undefined,
    });

    expect(items.map((item) => item.title)).toEqual(["Start", "Workspace A"]);
    expect(items[0]?.location).toEqual({ page: pages[0]!.ref });
  });
});
