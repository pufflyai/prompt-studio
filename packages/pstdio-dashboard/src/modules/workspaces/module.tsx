import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import {
  configuredRelatedOpenings,
  configuredResourceOpener,
  openDashboardResource,
} from "@/shared/workbench/resource-openers";
import { createDashboardWorkspaces } from "@/shared/workspaces/dashboard-workspaces";
import { registerWorkspaceHostActions } from "./workspace-host-actions";
import { watchOpenWorkspaceResource } from "./workspace-resource-sync";

// Core owns execution, permissions and synced workspace identity. Workspaces owns presentation.
export const createWorkspacesModule = () =>
  ({
    id: "dashboard.workspaces",
    activate(ctx) {
      ctx.modes.registerMode({
        id: "project",
        label: "Project",
        panels: ["main", "secondary", "side"],
        regionSettings: { side: { alwaysShowTabs: true }, secondary: { alwaysShowTabs: true } },
        activate: () => undefined,
      });
      ctx.resources.registerKind({
        kind: "workspace",
        extensionId: "pstdio",
        label: "Workspace",
        icon: "folder-git-2",
        relatedOpenings: (resource, signal) => configuredRelatedOpenings(ctx, resource, signal),
        resolve: (resource) => {
          const current = createDashboardWorkspaces(resource.projectId ?? getDashboardSelectedProjectId(ctx)).find(
            (workspace) => workspace.id === resource.id,
          )?.resource;
          if (!current) return resource;
          return {
            ...current,
            ...resource,
            label: current.label,
            icon: current.icon,
            metadata: { ...resource.metadata, ...current.metadata },
          };
        },
        subscribe: (listener) =>
          subscribeCollections((change) => {
            if (!change || change.table === "workspaces") listener();
          }),
      });
      ctx.resources.registerProvider({
        id: "dashboard-workbench.workspaces",
        kind: "workspace",
        list: () =>
          createDashboardWorkspaces(getDashboardSelectedProjectId(ctx)).flatMap((workspace) => {
            if (!configuredResourceOpener(ctx, workspace.resource)) return [];
            return [
              {
                resource: workspace.resource,
                activate: () => openDashboardResource(ctx, workspace.resource),
                searchText: [workspace.title, workspace.shorthand, workspace.branch].filter(Boolean).join(" "),
                group: "Workspaces",
              },
            ];
          }),
      });
      registerWorkspaceHostActions(ctx);
      const sync = watchOpenWorkspaceResource(ctx);
      return {
        dispose: () => {
          sync.dispose();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
