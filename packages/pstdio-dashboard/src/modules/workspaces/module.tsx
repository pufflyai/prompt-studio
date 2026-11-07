import { commandRefId, workspaceCommands } from "@pstdio/sdk/extensions";
import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { subscribeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import {
  createPresentationModule,
  resolvePresentationPage,
  workspacePresentationPath,
} from "@/shared/workbench/presentation-pages";
import { createDashboardWorkspaces } from "@/shared/workspaces/dashboard-workspaces";
import { registerWorkspaceHostActions } from "./workspace-host-actions";
import { workspaceRelatedOpenings } from "./workspace-related-openings";
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
        relatedOpenings: (resource, signal) => workspaceRelatedOpenings(ctx, resource, signal),
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
            const page = resolvePresentationPage(ctx, workspacePresentationPath(workspace.resource));
            if (!page) return [];
            return [
              {
                resource: workspace.resource,
                target: { kind: "page" as const, page: page.ref, resource: workspace.resource },
                searchText: [workspace.title, workspace.shorthand, workspace.branch].filter(Boolean).join(" "),
                group: "Workspaces",
              },
            ];
          }),
      });
      const presentation = createPresentationModule().activate(ctx);
      let palette: { dispose(): void } | undefined;
      const syncPalette = () => {
        const ready = !!resolvePresentationPage(ctx, "workspaces");
        if (ready && !palette)
          palette = ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
            commandId: dashboardCommandIds.openWorkspaces,
            order: 10,
          });
        if (!ready) {
          palette?.dispose();
          palette = undefined;
        }
      };
      const aliases = [
        { id: dashboardCommandIds.openWorkspaces, ref: workspaceCommands.open, label: "Go to workspaces" },
        { id: dashboardCommandIds.createWorkspace, ref: workspaceCommands.create, label: "New workspace" },
        { id: dashboardCommandIds.renameWorkspace, ref: workspaceCommands.rename, label: "Rename workspace" },
        { id: dashboardCommandIds.deleteWorkspace, ref: workspaceCommands.delete, label: "Delete workspace" },
      ];
      for (const alias of aliases)
        ctx.commands.registerCommand(
          { id: alias.id, label: alias.label },
          {
            execute: (args, invocation) => {
              const provider = resolvePresentationPage(ctx, "workspaces");
              if (!provider) throw new Error("Workspace presentation is unavailable");
              return ctx.commands.executeCommand(
                commandRefId({ ...alias.ref, extensionId: provider.ref.extensionId! }),
                args,
                alias.id === dashboardCommandIds.openWorkspaces ? { ...invocation, resource: undefined } : invocation,
              );
            },
          },
        );
      const unsubscribePages = ctx.pages.store.subscribeSelector((state) => state.pages, syncPalette);
      syncPalette();
      registerWorkspaceHostActions(ctx);
      const sync = watchOpenWorkspaceResource(ctx);
      return {
        dispose: () => {
          sync.dispose();
          presentation.dispose();
          unsubscribePages();
          palette?.dispose();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
