import { expect, mock, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  getDashboardActiveCollection,
  getDashboardSelectedResource,
  selectDashboardNavigationResource,
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
    selectDashboardNavigationResource(workbench, {
      kind: "dashboard-view",
      uri: "dashboard-workbench://projects/project-1/sessions",
      id: "sessions",
      label: "Sessions",
    });

    const labResource = workbench.resources.listResources("").find((entry) => entry.resource.id === "lab")?.resource;
    const persistedLabResource = {
      ...labResource!,
      metadata: { projectId: "project-1", routePath: "lab" },
    };
    await workbench.resources.openResource(persistedLabResource);

    expect(getDashboardActiveCollection(workbench)).toBeUndefined();
    expect(getDashboardSelectedResource(workbench)?.uri).toBe(labResource?.uri);
    expect(getDashboardSelectedResource(workbench)?.metadata?.route).toEqual(metadata.routes[0]);
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
        action: { kind: "panel", panelId: "extension-lab.board" },
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
    const board = sections[0]!.nodes[0]!.resource!;
    await workbench.resources.openResource(board, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(getDashboardSelectedResource(workbench)?.uri).toBe(board.uri);
    expect(workbench.getPrimaryResource()?.uri).toBe(board.uri);
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Board"]);
    expect(workbench.history.store.getState().entries.map((entry) => entry.resource?.uri)).toEqual([
      ticket.uri,
      board.uri,
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
          type: "extension-view",
          id: "pstdio-planner.tickets",
          label: "Tickets",
          icon: "square-kanban",
        },
      },
    };
    setResourceBreadcrumb(workbench, ticket);

    const items = workbench.breadcrumbs.getItems();
    expect(items?.map((item) => item.title)).toEqual(["Tickets", "PS-1 Ticket"]);
    expect(items?.[0]?.resource?.uri).toBe(
      "dashboard-workbench://project/project-1/extension-views/pstdio-planner.tickets",
    );
  } finally {
    disposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});
