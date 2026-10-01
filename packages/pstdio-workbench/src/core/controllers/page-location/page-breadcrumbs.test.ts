import { describe, expect, test } from "bun:test";
import type { NavigationTargetPage, PageLocation } from "@pstdio/sdk/extensions";
import { createNavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { createWorkbenchBreadcrumbController } from "../breadcrumbs/breadcrumb-registry";
import { createWorkbenchPageBreadcrumbItems, setWorkbenchPageBreadcrumbs } from "./page-breadcrumbs";

const resources = {
  normalize: (resource: { type: string; id: string; label?: string }) => ({ ...resource }),
  toUri: (resource: { type: string; id: string }) => `pstdio://${resource.type}/${resource.id}`,
  fromUri: () => undefined,
};
const navigationTrees = createNavigationTreeRegistry();
// A page that owns a content navigation tree starts a Sidenav level.
const openLevel = (pageId: string) =>
  navigationTrees.registerContribution({
    id: `${pageId}.content`,
    owner: { kind: "page", id: pageId, extensionId: "planner" },
    sourceExtensionId: "planner",
    declarationIndex: 0,
    slot: "content",
    getSections: () => [],
  });
const page = (id: string, title: string): WorkbenchPageContribution => ({
  id,
  ref: { extensionId: "planner", kind: "page", id },
  title,
  path: id,
  modeId: "project",
  main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
  slots: [],
});
describe("page breadcrumbs", () => {
  test("derives one trail from the canonical parent chain", () => {
    const tickets = page("tickets", "Tickets");
    const ticket = { ...page("ticket", "Ticket"), parentId: tickets.id };
    const location: PageLocation = {
      page: ticket.ref,
      resource: {
        type: "ticket",
        id: "PS-326",
        label: "PS-326 Additive pages",
        extensionId: "planner",
        projectId: "project-1",
      },
      parent: { page: tickets.ref },
    };
    const targets: NavigationTargetPage[] = [];
    const items = createWorkbenchPageBreadcrumbItems({
      location,
      pages: [tickets, ticket],
      navigationTrees,
      resources,
      navigate: (target) => targets.push(target),
    });
    expect(items.map((item) => item.title)).toEqual(["Tickets", "PS-326 Additive pages"]);
    expect(items.at(-1)?.resource).toEqual(location.resource);
    items[0]?.onClick?.();
    expect(targets).toEqual([{ kind: "page", page: tickets.ref }]);
    expect(items[1]?.onClick).toBeUndefined();
  });
  test("shows a resource's own icon and falls back to the page icon", () => {
    const workspaces = { ...page("workspaces", "Workspaces"), icon: "computer" };
    const workspace = { ...page("workspace", "Workspace"), icon: "computer", parentId: workspaces.id };
    const items = createWorkbenchPageBreadcrumbItems({
      location: {
        page: workspace.ref,
        resource: { type: "workspace", id: "ws-1", label: "Project workspace", icon: "Folder" },
        parent: { page: workspaces.ref },
      },
      pages: [workspaces, workspace],
      navigationTrees,
      resources,
      navigate: () => undefined,
    });
    expect(items.map((item) => item.icon)).toEqual(["computer", "Folder"]);
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
      navigationTrees,
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
  test("marks only the crumbs that open a Sidenav level", () => {
    const tickets = page("tickets", "Tickets");
    const sessions = page("sessions", "Sessions");
    const session = { ...page("session", "Session"), parentId: sessions.id };
    const level = openLevel(sessions.id);
    const build = (location: PageLocation, pages: WorkbenchPageContribution[]) =>
      createWorkbenchPageBreadcrumbItems({
        location,
        pages,
        navigationTrees,
        resources,
        navigate: () => undefined,
      });
    const insideLevel = build(
      {
        page: session.ref,
        resource: { type: "session", id: "s-1", label: "Level session" },
        parent: { page: sessions.ref },
      },
      [sessions, session],
    );
    expect(insideLevel.map((item) => [item.title, item.startsLevel])).toEqual([
      ["Sessions", true],
      ["Level session", undefined],
    ]);
    expect(build({ page: tickets.ref }, [tickets]).map((item) => item.startsLevel)).toEqual([undefined]);
    level.dispose();
    expect(build({ page: sessions.ref }, [sessions]).map((item) => item.startsLevel)).toEqual([undefined]);
  });
});
