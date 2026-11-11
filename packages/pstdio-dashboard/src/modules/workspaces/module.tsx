import {
  commandRefId,
  contributionRefId,
  type ResourceRef,
  workbenchPages,
  workspaceCommands,
  workspacePages,
  workspaceViews,
} from "@pstdio/sdk/extensions";
import { type WorkbenchModuleContribution, workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { subscribeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { workspacePageForResource } from "@/shared/workbench/page-navigation";
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
          createDashboardWorkspaces(getDashboardSelectedProjectId(ctx)).map((workspace) => ({
            resource: workspace.resource,
            target: {
              kind: "page",
              page: workspacePageForResource(workspace.resource as ResourceRef),
              resource: workspace.resource,
            },
            searchText: [workspace.title, workspace.shorthand, workspace.branch].filter(Boolean).join(" "),
            group: "Workspaces",
          })),
      });
      // Saved host URLs are available only while their ordinary provider views are installed.
      const registrations: Array<{ dispose(): void }> = [];
      const syncAliases = () => {
        const ready = Object.values(workspaceViews).every((view) => ctx.views.getView(contributionRefId(view)));
        if (!ready) {
          while (registrations.length) registrations.pop()!.dispose();
          return;
        }
        if (registrations.length) return;
        registrations.push(
          ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
            commandId: dashboardCommandIds.openWorkspaces,
            order: 10,
          }),
        );
        registrations.push(
          ctx.pages.registerPage({
            id: workbenchPages.workspaces.id,
            ref: workbenchPages.workspaces,
            title: "Workspaces",
            icon: "folder-git-2",
            path: "workspaces",
            modeId: "project",
            main: {
              kind: "view",
              view: workspaceViews.list,
              cardinality: "one",
              presentation: "tabs",
              tab: {
                getSnapshot: () => ({
                  label: "Workspaces",
                  menu: [
                    {
                      id: "workspaces",
                      rows: [
                        {
                          id: "create-workspace",
                          label: "Create workspace",
                          icon: "plus",
                          action: { kind: "command", commandId: commandRefId(workspaceCommands.create) },
                        },
                      ],
                    },
                  ],
                }),
              },
            },
            slots: [],
          }),
        );
        registrations.push(
          ctx.pages.registerPage({
            id: workbenchPages.workspace.id,
            ref: workbenchPages.workspace,
            title: "Workspace",
            icon: "folder-git-2",
            path: "workspace",
            modeId: "project",
            parentId: workbenchPages.workspaces.id,
            resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
            document: { metadataKey: "workspaceFilePath" },
            main: { kind: "panels", landing: "files", empty: workspaceViews.summary },
            slots: [
              {
                id: "history",
                region: "main",
                isAvailable: (resource) => workspacePageForResource(resource).id === workspacePages.history.id,
                tab: { getSnapshot: () => ({ label: "Session history" }) },
                item: { kind: "view", view: workspaceViews.history, presence: "open" },
              },
              {
                id: "files",
                region: "main",
                isAvailable: (resource) =>
                  [workspacePages.files.id, workspacePages.workspace.id].includes(
                    workspacePageForResource(resource).id,
                  ),
                tab: { getSnapshot: () => ({ label: "Files" }) },
                item: { kind: "view", view: workspaceViews.file, presence: "open" },
              },
              {
                id: "changes",
                region: "main",
                isAvailable: (resource) => workspacePageForResource(resource).id === workspacePages.workspace.id,
                tab: { getSnapshot: () => ({ label: "Changes" }) },
                item: { kind: "view", view: workspaceViews.changes, presence: "open" },
              },
            ],
          }),
        );
      };
      const aliases = [
        { id: dashboardCommandIds.openWorkspaces, ref: workspaceCommands.open, label: "Go to workspaces" },
        { id: dashboardCommandIds.createWorkspace, ref: workspaceCommands.create, label: "New workspace" },
        { id: dashboardCommandIds.renameWorkspace, ref: workspaceCommands.rename, label: "Rename workspace" },
        { id: dashboardCommandIds.deleteWorkspace, ref: workspaceCommands.delete, label: "Delete workspace" },
      ];
      for (const alias of aliases)
        ctx.commands.registerCommand(
          { id: alias.id, label: alias.label, category: "Workspaces", icon: "FolderGit2" },
          {
            execute: (args, invocation) =>
              ctx.commands.executeCommand(
                commandRefId(alias.ref),
                args,
                alias.id === dashboardCommandIds.openWorkspaces ? { ...invocation, resource: undefined } : invocation,
              ),
          },
        );
      const unsubscribeViews = ctx.views.store.subscribe(syncAliases);
      syncAliases();
      registerWorkspaceHostActions(ctx);
      const sync = watchOpenWorkspaceResource(ctx);
      return {
        dispose: () => {
          sync.dispose();
          unsubscribeViews();
          while (registrations.length) registrations.pop()!.dispose();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
