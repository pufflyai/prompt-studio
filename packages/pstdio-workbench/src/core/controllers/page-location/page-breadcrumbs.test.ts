import { describe, expect, test } from "bun:test";
import type { NavigationTargetPage, PageLocation } from "@pstdio/sdk/extensions";
import { createNavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { createWorkbench } from "../../workbench-core";
import { createWorkbenchBreadcrumbController } from "../breadcrumbs/breadcrumb-registry";
import { createWorkbenchPageBreadcrumbItems, setWorkbenchPageBreadcrumbs } from "./page-breadcrumbs";

const resources = {
  normalize: (resource: { type: string; id: string; label?: string }) => ({ ...resource }),
  toUri: (resource: { type: string; id: string }) => `pstdio://${resource.type}/${resource.id}`,
  fromUri: () => undefined,
};
const layout = createWorkbench().layout.getLayout();
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
// The Lab mode hides the project Sidenav.
const modes = {
  getMode: (id: string) => (id === "lab" ? { chrome: { sidenav: false as const } } : undefined),
};
const page = (id: string, title: string): WorkbenchPageContribution => ({
  id,
  ref: { extensionId: "planner", kind: "page", id },
  title,
  path: id,
  modeId: "project",
  main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
  slots: [],
});
test("a page-owned resource uses its resource breadcrumb even though Main has no tabs", () => {
  const document: WorkbenchPageContribution = {
    ...page("document", "Document"),
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: {
      kind: "view",
      view: { kind: "view", id: "content" },
      cardinality: "one",
      presentation: "page",
      empty: { view: { kind: "view", id: "empty" }, breadcrumb: { label: "New document" } },
    },
  };
  const resource = { type: "document", id: "x", label: "Document X" };
  const items = createWorkbenchPageBreadcrumbItems({
    location: { page: document.ref, resource },
    pages: [document],
    navigationTrees,
    layout,
    modes,
    resources,
    navigate() {},
  });
  expect(items[0].title).toBe("Document X");
  expect(items[0].resource).toEqual(resource);
});
test("a current page supplies breadcrumb actions without owning a tab or resource", () => {
  const sessions = {
    ...page("sessions", "Sessions"),
    main: {
      kind: "panels" as const,
      empty: {
        view: { kind: "view" as const, id: "composer" },
        breadcrumb: {
          label: "New session",
          menu: [
            {
              id: "sessions",
              rows: [
                { id: "new", label: "New session", action: { kind: "command" as const, commandId: "new-session" } },
              ],
            },
          ],
        },
      },
    },
  };
  const items = createWorkbenchPageBreadcrumbItems({
    location: { page: sessions.ref },
    pages: [sessions],
    navigationTrees,
    layout,
    modes,
    resources,
    navigate() {},
  });
  expect(items[0]).toMatchObject({ title: "New session", menu: sessions.main.empty.breadcrumb.menu });
  const child = page("session", "Session");
  const parents = createWorkbenchPageBreadcrumbItems({
    location: { page: child.ref, parent: { page: sessions.ref } },
    pages: [sessions, child],
    navigationTrees,
    layout,
    modes,
    resources,
    navigate() {},
  });
  expect(parents[0]?.title).toBe("Sessions");
  expect(parents[0]?.menu).toBeUndefined();
});
describe("page breadcrumbs", () => {
  test("names a child page when it shares its parent's resource", () => {
    const tickets = page("tickets", "Tickets");
    const ticket = { ...page("ticket", "Ticket"), parentId: tickets.id };
    const requests = { ...page("requests", "Review requests"), parentId: ticket.id, icon: "message-circle-warning" };
    const resource = { type: "ticket", id: "PS-1", label: "PS-1 Add tags", icon: "component" };
    const items = createWorkbenchPageBreadcrumbItems({
      location: {
        page: requests.ref,
        resource: { ...resource, metadata: { documentId: "review-requests" } },
        parent: { page: ticket.ref, resource, parent: { page: tickets.ref } },
      },
      pages: [tickets, ticket, requests],
      navigationTrees,
      layout,
      modes,
      resources,
      navigate: () => undefined,
    });
    expect(items.map((item) => item.title)).toEqual(["Tickets", "PS-1 Add tags", "Review requests"]);
    expect(items.at(-1)?.resource?.id).toBe("PS-1");
    expect(items.at(-1)?.icon).toBe("message-circle-warning");
  });

  test("names a selected file below its ticket and returns the parent to the body", () => {
    const tickets = page("tickets", "Tickets");
    const ticket = { ...page("ticket", "Ticket"), document: { metadataKey: "documentId" }, icon: "component" };
    const resource = { type: "ticket", id: "PS-1", label: "PS-1 Add tags", icon: "component" };
    const targets: NavigationTargetPage[] = [];
    const parent = { page: ticket.ref, resource, parent: { page: tickets.ref } };
    const items = createWorkbenchPageBreadcrumbItems({
      location: {
        page: ticket.ref,
        resource: { ...resource, label: "notes.md", icon: "file-text", metadata: { documentId: "notes" } },
        parent,
      },
      pages: [tickets, ticket],
      navigationTrees,
      layout,
      modes,
      resources,
      navigate: (target) => targets.push(target),
    });
    expect(items.map((item) => item.title)).toEqual(["Tickets", "PS-1 Add tags", "notes.md"]);
    expect(items.map((item) => item.icon)).toEqual([undefined, "component", "file-text"]);
    items[1]?.onClick?.();
    expect(targets).toEqual([
      { kind: "page", page: ticket.ref, resource, parent: { kind: "page", page: tickets.ref } },
    ]);
  });
  test("keeps the current resource breadcrumb focused on the resource", () => {
    const workspace: WorkbenchPageContribution = {
      ...page("workspace", "Workspace"),
      main: { kind: "panels", empty: { kind: "view", id: "empty" } },
      slots: [
        {
          id: "files",
          region: "main",
          item: { kind: "view", view: { kind: "view", id: "files" }, presence: "fixed" },
        },
      ],
    };
    const resource = { type: "workspace", id: "ws-1", label: "WS-1" };
    const items = createWorkbenchPageBreadcrumbItems({
      location: { page: workspace.ref, resource },
      pages: [workspace],
      navigationTrees,
      layout,
      modes,
      resources,
      navigate: () => undefined,
      openPanel: () => undefined,
    });
    expect(items[0].resource).toEqual(resource);
    expect(items[0].onClick).toBeUndefined();
  });
  test("returns a panel page to its declared landing panel from its current breadcrumb", () => {
    const library: WorkbenchPageContribution = {
      ...page("artifacts", "Artifacts"),
      main: { kind: "panels", empty: { kind: "view", id: "empty" }, landing: "library" },
      slots: [
        {
          id: "library",
          region: "main",
          item: { kind: "view", view: { kind: "view", id: "library" }, presence: "fixed" },
        },
      ],
    };
    const targets: NavigationTargetPage[] = [];
    const panels: string[] = [];
    const items = createWorkbenchPageBreadcrumbItems({
      location: { page: library.ref },
      pages: [library],
      navigationTrees,
      layout,
      modes,
      resources,
      navigate: (target) => targets.push(target),
      openPanel: (pageId, slotId) => panels.push(`${pageId}:${slotId}`),
    });
    items[0].onClick?.();
    expect(targets).toEqual([{ kind: "page", page: library.ref }]);
    expect(panels).toEqual(["artifacts:library"]);
  });
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
      layout,
      modes,
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
      layout,
      modes,
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
      layout,
      modes,
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
describe("breadcrumb navigation levels", () => {
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
        layout,
        modes,
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
    const lab = { ...page("lab", "Lab"), modeId: "lab" };
    expect(build({ page: lab.ref }, [lab]).map((item) => item.startsLevel)).toEqual([true]);
  });
});
