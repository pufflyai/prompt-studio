import {
  defineNavigationTree,
  defineView,
  l10n,
  type NavigationTarget,
  workbenchCommands,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { refreshEvents } from "./events";
import { workspaceResource } from "./model";
import { workspaceCommands, workspacePages } from "./refs";

export const sidebarView = defineView({
  id: "sidebar",
  title: l10n("sidebar.title", "Project Workspaces"),
  body: {
    kind: "tree",
    refreshEvents,
    defaultExpandedSectionIds: ["project-workspaces"],
    async body(ctx) {
      const workspace = await ctx.workspaces.getDefault();
      const resource = workspace ? workspaceResource(workspace, ctx.project.id) : undefined;
      let filesTarget: NavigationTarget | undefined;
      if (!workspace) filesTarget = { kind: "command", target: { command: workbenchCommands.chooseProjectFolder } };
      else if (resource?.metadata?.workspaceSupportsFiles)
        filesTarget = { kind: "page", page: workspacePages.files, resource };
      return [
        {
          id: "project-workspaces",
          label: l10n("sidebar.title", "Project Workspaces"),
          nodes: [
            ...(filesTarget
              ? [
                  {
                    id: "files",
                    label: l10n("sidebar.files", "Files"),
                    icon: "files",
                    canHide: true,
                    canReorder: true,
                    target: filesTarget,
                  },
                ]
              : []),
            {
              id: "workspaces",
              label: l10n("sidebar.workspaces", "Workspaces"),
              icon: "folder-git-2",
              canHide: true,
              canReorder: true,
              target: { kind: "page", page: workspacePages.list },
              contextMenuActions: [
                {
                  id: "create-workspace",
                  label: l10n("action.create", "Create workspace"),
                  icon: "plus",
                  command: workspaceCommands.create,
                },
              ],
            },
          ],
        },
      ];
    },
  },
});
export const sidebar = defineNavigationTree({
  id: "project-workspaces",
  owner: workbenchModes.project,
  slot: "content",
  resourceScope: "project",
  view: sidebarView.ref,
});
