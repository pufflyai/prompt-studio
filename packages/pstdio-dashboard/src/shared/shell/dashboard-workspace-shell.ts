import type { ResourceRef, ShellModuleContribution, TreeViewSection } from "pstdio-shell/core";
import type { MutableRefObject } from "react";
import { createDashboardProjectShell } from "./dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";
import {
  TICKET_DETAILS_NAVIGATION_OPENER_ID,
  TICKET_DETAILS_NAVIGATION_RESOURCE_KIND,
} from "./ticket-details/dashboard-ticket-details-module";

export const WORKSPACE_RESOURCE_KIND = "workspace";
export const WORKSPACE_MODE_ID = "workspace";
export const WORKSPACE_NAVIGATION_TREE_ID = "workspace.navigation";
export const WORKSPACE_MAIN_WIDGET_ID = "workspace.main";
export const WORKSPACE_OPEN_COMMAND_ID = "workspace.open";
export const WORKSPACE_NAVIGATION_PARSER_ID = "dashboard.workspaceUri";
export const WORKSPACE_NAVIGATOR_ID = "dashboard.workspaceRouter";

const WORKSPACE_ICON = "GitBranch";
const WORKSPACE_CONTRIBUTION_PRIORITY = 230;

interface CreateDashboardWorkspaceShellInput {
  projectId: string;
  projectName: string;
  ticketShorthand: string;
  workspaceShorthand: string;
  navigation: MutableRefObject<DashboardWorkspaceNavigationState>;
  navigate: (path: string) => void;
}

export interface DashboardWorkspaceNavigationState {
  getSections: () => TreeViewSection[];
  openResource: (resource: ResourceRef) => void;
}

export const createWorkspaceResource = (
  projectId: string,
  ticketShorthand: string,
  workspaceShorthand: string,
): ResourceRef => ({
  kind: WORKSPACE_RESOURCE_KIND,
  uri: `pstdio://project/${projectId}/ticket/${ticketShorthand}/workspace/${workspaceShorthand}`,
  id: workspaceShorthand,
  label: workspaceShorthand,
  icon: WORKSPACE_ICON,
  metadata: { projectId, ticketShorthand, workspaceShorthand },
});

const parseWorkspaceUri = (uri: string) => {
  const match = uri.match(/^pstdio:\/\/project\/([^/]+)\/ticket\/([^/]+)\/workspace\/([^/]+)$/);
  if (!match) return null;

  return {
    projectId: match[1],
    ticketShorthand: match[2],
    workspaceShorthand: match[3],
  };
};

const createWorkspaceHref = (projectId: string, ticketShorthand: string, workspaceShorthand: string) =>
  `/projects/${projectId}/tickets/${ticketShorthand}/workspaces/${workspaceShorthand}`;

const hrefFromResource = (resource: ResourceRef) => {
  const parsed = parseWorkspaceUri(resource.uri);
  return parsed ? createWorkspaceHref(parsed.projectId, parsed.ticketShorthand, parsed.workspaceShorthand) : "/";
};

const createInitialWorkspaceResource = (input: CreateDashboardWorkspaceShellInput) =>
  createWorkspaceResource(input.projectId, input.ticketShorthand, input.workspaceShorthand);

const createDashboardWorkspaceModule = (input: CreateDashboardWorkspaceShellInput): ShellModuleContribution => ({
  id: "dashboard.workspace",
  activate(ctx) {
    const workspaceResource = createInitialWorkspaceResource(input);

    return [
      ctx.resources.registerKind({
        kind: WORKSPACE_RESOURCE_KIND,
        label: "Workspace",
        icon: WORKSPACE_ICON,
      }),
      ctx.navigation.registerParser({
        id: WORKSPACE_NAVIGATION_PARSER_ID,
        priority: WORKSPACE_CONTRIBUTION_PRIORITY,
        canParse: (location) => parseWorkspaceUri(location) !== null,
        parse: (location) => {
          const parsed = parseWorkspaceUri(location);
          if (!parsed) return workspaceResource;

          return createWorkspaceResource(parsed.projectId, parsed.ticketShorthand, parsed.workspaceShorthand);
        },
      }),
      ctx.navigation.registerNavigator({
        id: WORKSPACE_NAVIGATOR_ID,
        priority: WORKSPACE_CONTRIBUTION_PRIORITY,
        canNavigate: (resource) => resource.kind === WORKSPACE_RESOURCE_KIND,
        createHref: hrefFromResource,
        navigate: (resource) => {
          const href = hrefFromResource(resource);
          input.navigate(href);
          return href;
        },
      }),
      ctx.modes.registerMode({
        id: WORKSPACE_MODE_ID,
        label: "Workspace",
        activate: (modeCtx) =>
          modeCtx.trees.registerTreeView({
            id: WORKSPACE_NAVIGATION_TREE_ID,
            title: "Ticket navigation",
            area: "left",
            areaSize: { defaultPx: 240, minPx: 200 },
            icon: WORKSPACE_ICON,
            defaultExpandedSectionIds: ["files", "sub-tickets", "workspaces", "sessions"],
            getRoots: () => [],
            getChildren: () => [],
            getSections: () => input.navigation.current.getSections(),
          }),
      }),
      ctx.layout.registerWidget({
        id: WORKSPACE_MAIN_WIDGET_ID,
        title: "Workspace",
        area: "main",
        singleton: true,
        resourceKinds: [WORKSPACE_RESOURCE_KIND],
        renderer: "react",
        rendererId: WORKSPACE_MAIN_WIDGET_ID,
      }),
      ctx.resources.registerOpener({
        id: WORKSPACE_MAIN_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === WORKSPACE_RESOURCE_KIND,
        open: async (resource, openInput) => {
          await ctx.navigation.navigateResource(resource);
          return ctx.layout.openWidget(WORKSPACE_MAIN_WIDGET_ID, {
            resource,
            replaceActive: openInput.replaceActive,
            closable: false,
          });
        },
      }),
      ctx.resources.registerOpener({
        id: `${TICKET_DETAILS_NAVIGATION_OPENER_ID}.workspace`,
        priority: 200,
        canOpen: (resource) => resource.kind === TICKET_DETAILS_NAVIGATION_RESOURCE_KIND,
        open: (resource) => input.navigation.current.openResource(resource),
      }),
      ctx.commands.registerCommand(
        {
          id: WORKSPACE_OPEN_COMMAND_ID,
          label: "Open workspace",
          category: "Workspaces",
          description: "Open the selected workspace",
          icon: WORKSPACE_ICON,
        },
        {
          execute: () => ctx.resources.openResource(workspaceResource),
        },
      ),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: WORKSPACE_OPEN_COMMAND_ID,
        label: "Open workspace",
        icon: WORKSPACE_ICON,
      }),
    ];
  },
});

export const createDashboardWorkspaceShell = (input: CreateDashboardWorkspaceShellInput) => {
  const shell = createDashboardProjectShell({
    projectId: input.projectId,
    projectName: input.projectName,
    navigate: input.navigate,
    showProjectNavigationTree: false,
  });
  const disposable = shell.registerModule(createDashboardWorkspaceModule(input));

  shell.modes.setActiveMode(WORKSPACE_MODE_ID);
  shell.layout.openWidget(WORKSPACE_MAIN_WIDGET_ID, {
    resource: createInitialWorkspaceResource(input),
    closable: false,
  });

  return {
    ...shell,
    dispose: () => {
      disposable.dispose();
      shell.dispose();
    },
  };
};
