import { expect, mock, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  getDashboardActiveCollection,
  getDashboardSelectedResource,
  selectDashboardNavigationResource,
  selectDashboardNavigationView,
} from "@/shared/app/navigation-state";
import { selectDashboardProject } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { buildDashboardExtensionTreeSections } from "@/shared/extensions/workbench-extension-tree-sections";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadata } from "./module-test-fixtures";

test("restores extension route navigation after leaving a global collection", async () => {
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata: mock(async () => metadata) }));

  try {
    await flushMicrotasks();
    selectDashboardNavigationView(workbench, "sessions");
    expect(getDashboardActiveCollection(workbench)).toBe("sessions");

    await workbench.views.openView("extension-lab.labPage");

    expect(getDashboardActiveCollection(workbench)).toBeUndefined();
    expect(getDashboardSelectedResource(workbench)).toBeUndefined();
    expect(workbench.layout.getLayout().regions.main.widgets[0]?.viewId).toBe("extension-lab.labPage");
    expect(getCachedDashboardExtensionMetadata("project-1")?.routes[0]).toEqual(metadata.routes[0]);
  } finally {
    disposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});

test("panel tree navigation leaves ticket detail state through a project resource", async () => {
  const workbench = createWorkbenchCore();
  const panelMetadata: WorkbenchExtensionMetadata = {
    ...metadata,
    treeItems: [
      {
        id: "extension-lab.board-link",
        extensionId: "pstdio.extension-lab",
        target: "workbench.left.tree",
        label: "Board",
        action: { kind: "view", viewId: "extension-lab.board" },
      },
    ],
    panels: [
      {
        id: "extension-lab.board",
        extensionId: "pstdio.extension-lab",
        title: "Board",
        show: { region: "main" },
        webview: metadata.routes[0]!.webview,
      },
    ],
  };

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.modes.registerMode({ id: "ticket", label: "Ticket", activate: () => undefined });
  workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
  workbench.layout.registerPanel({
    id: "ticket",
    title: "Ticket",
    region: "main",
    rendererId: "test",
  });
  workbench.resources.registerPresenter({
    id: "ticket",
    canOpen: (resource) => resource.kind === "ticket",
    open: (resource) => workbench.layout.openPanel("ticket", { resource }),
  });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposable = workbench.registerModule(
    createExtensionsModule({ loadMetadata: mock(async () => panelMetadata) }),
  );

  try {
    await flushMicrotasks();
    const ticket = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/PS-1",
      id: "PS-1",
      label: "PS-1 Ticket",
      metadata: { projectId: "project-1" },
    };
    selectDashboardNavigationResource(workbench, ticket, { modeId: "ticket" });
    await workbench.resources.openResource(ticket);

    const sections = buildDashboardExtensionTreeSections({
      metadata: getCachedDashboardExtensionMetadata("project-1")!,
      modeId: "ticket",
      projectId: "project-1",
      target: "workbench.left.tree",
    });
    const board = sections[0]!.nodes[0]!.target!;
    await workbench.navigation.openTarget(board);

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(getDashboardSelectedResource(workbench)).toBeUndefined();
    expect(workbench.getPrimaryResource()).toBeUndefined();
    expect(workbench.layout.getLayout().regions.main.widgets[0]?.viewId).toBe("extension-lab.board");
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Board"]);
    expect(
      workbench.history.store.getState().entries.map((entry) => ({
        resourceUri: entry.resource?.uri,
        viewId: entry.viewId,
      })),
    ).toEqual([
      { resourceUri: ticket.uri, viewId: undefined },
      { resourceUri: undefined, viewId: "extension-lab.board" },
    ]);
  } finally {
    disposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});

test("ticket breadcrumbs include the Tickets browse root", async () => {
  const workbench = createWorkbenchCore();
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
  workbench.layout.registerPanel({ id: "tickets", title: "Tickets", region: "main", rendererId: "test" });
  workbench.views.registerView({
    id: "pstdio-planner.tickets",
    panelId: "tickets",
    title: "Tickets",
    icon: "square-kanban",
  });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata: mock(async () => metadata) }));

  try {
    await flushMicrotasks();
    const ticket = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/PS-1",
      id: "PS-1",
      label: "PS-1 Ticket",
      metadata: {
        projectId: "project-1",
        shorthand: "PS-1",
        resourceParent: {
          type: "view",
          viewId: "pstdio-planner.tickets",
        },
      },
    };
    setResourceBreadcrumb(workbench, ticket);

    const items = workbench.breadcrumbs.getItems();
    expect(items?.map((item) => item.title)).toEqual(["Tickets", "PS-1 Ticket"]);
    expect(items?.[0]?.resource).toBeUndefined();
    expect(items?.[0]?.onClick).toBeFunction();
  } finally {
    disposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});
