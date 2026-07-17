import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench/core";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import {
  getSidebarContributionHeaderNodes,
  getSidebarContributionResourceSections,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { registerExtensionSidebarContributions } from "../extensions/extension-sidebar-contributions";
import { createNotificationsModule } from "../notifications/module";
import { createSessionsModule } from "../sessions/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSidebarModule } from "./module";

describe("createSidebarModule", () => {
  test("orders primary navigation below notifications in the sidebar header", () => {
    const workbench = createWorkbenchCore();
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      dataRenderers: [
        {
          id: "pstdio-core-tickets.tickets",
          extensionId: "pstdio.pstdio-core-tickets",
          title: "Tickets",
          resourceKind: "ticket",
          queryCommandId: "pstdio-core-tickets.query-tickets",
        },
      ],
    };

    workbench.registerModule(createSidebarModule());
    workbench.registerModule(createNotificationsModule());
    workbench.registerModule(createSessionsModule());
    workbench.registerModule(createWorkspacesModule());
    workbench.registerModule({
      id: "test.extension-sidebar",
      activate(ctx) {
        registerExtensionSidebarContributions(ctx, () => ({ metadata, projectId: "project-1" }));
        return undefined;
      },
    });

    expect(getSidebarContributionHeaderNodes(workbench, "workspace").map((node) => node.label)).toEqual([
      "Search",
      "Notifications",
      "Sessions",
      "Workspaces",
      "Tickets",
    ]);
  });

  test("contributes selected resource children in extension-declared modes", () => {
    const workbench = createWorkbenchCore();
    const selected: ResourceRef = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/ticket-1",
      id: "ticket-1",
      label: "Ticket",
    };
    const child: ResourceRef = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/workspace-1",
      id: "workspace-1",
      label: "Workspace",
      parent: selected.uri,
    };

    workbench.resources.registerProvider({
      id: "test.resource-children",
      kind: child.kind,
      list: () => [{ resource: child }],
    });
    workbench.registerModule(createSidebarModule());

    expect(getSidebarContributionResourceSections(workbench, "ticket", { resource: selected })).toEqual([
      {
        id: "resource-children",
        label: "Workspaces",
        nodes: [{ id: child.uri, label: "Workspace", resource: child }],
        resource: selected,
      },
    ]);
  });

  test("does not enumerate children for aggregate dashboard pages", () => {
    const workbench = createWorkbenchCore();
    const selected: ResourceRef = {
      kind: "dashboard-view",
      uri: "dashboard-workbench://dashboard-view/workspaces",
      id: "workspaces",
      label: "Workspaces",
    };
    let listCalls = 0;

    workbench.resources.registerProvider({
      id: "test.aggregate-children",
      kind: "workspace",
      list: () => {
        listCalls += 1;
        return [];
      },
    });
    workbench.registerModule(createSidebarModule());

    expect(getSidebarContributionResourceSections(workbench, "workspace", { resource: selected })).toEqual([]);
    expect(listCalls).toBe(0);
  });
});
