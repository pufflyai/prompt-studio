import {
  activateProductModule,
  type ProductModuleContribution,
  type ResourceRef,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-shell/core";
import { createDashboardProjectShell } from "./dashboard-project-shell";
import type { DashboardShellStorage } from "./dashboard-shell-persistence";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const TICKETS_RESOURCE_KIND = "tickets";
export const TICKETS_MAIN_WIDGET_ID = "tickets.main";
export const TICKETS_OPEN_COMMAND_ID = "tickets.open";
export const TICKETS_CREATE_COMMAND_ID = "tickets.create";
export const TICKETS_NAVIGATION_PARSER_ID = "dashboard.ticketsUri";
export const TICKETS_NAVIGATOR_ID = "dashboard.ticketsRouter";

const TICKETS_ICON = "KanbanSquare";
const TICKETS_CONTRIBUTION_PRIORITY = 200;

interface CreateDashboardTicketsShellInput {
  projectId: string;
  projectName: string;
  navigate: (path: string) => void;
  requestCreateTicket: () => void;
  requestCreateSession?: () => void;
  openCommandPalette?: () => void;
  openShortcutHelp?: () => void;
  storage?: DashboardShellStorage;
}

export const createTicketsResource = (projectId: string): ResourceRef => ({
  kind: TICKETS_RESOURCE_KIND,
  uri: `pstdio://project/${projectId}/tickets`,
  id: "tickets",
  label: "Tickets",
  icon: TICKETS_ICON,
});

const parseTicketsUri = (uri: string) => {
  const match = uri.match(/^pstdio:\/\/project\/([^/]+)\/tickets$/);
  if (!match) return null;

  return { projectId: match[1] };
};

const createTicketsHref = (projectId: string) => `/projects/${projectId}/tickets`;

const hrefFromResource = (resource: ResourceRef) => {
  const parsed = parseTicketsUri(resource.uri);
  return parsed ? createTicketsHref(parsed.projectId) : "/";
};

const createDashboardTicketsModule = (input: CreateDashboardTicketsShellInput): ProductModuleContribution => ({
  id: "dashboard.tickets",
  activate(ctx) {
    const ticketsResource = createTicketsResource(input.projectId);

    return [
      ctx.resources.registerKind({ kind: TICKETS_RESOURCE_KIND, label: "Tickets", icon: TICKETS_ICON }),
      ctx.navigation.registerParser({
        id: TICKETS_NAVIGATION_PARSER_ID,
        priority: TICKETS_CONTRIBUTION_PRIORITY,
        canParse: (location) => parseTicketsUri(location) !== null,
        parse: (location) => {
          const parsed = parseTicketsUri(location);
          return createTicketsResource(parsed?.projectId ?? input.projectId);
        },
      }),
      ctx.navigation.registerNavigator({
        id: TICKETS_NAVIGATOR_ID,
        priority: TICKETS_CONTRIBUTION_PRIORITY,
        canNavigate: (resource) => resource.kind === TICKETS_RESOURCE_KIND,
        createHref: hrefFromResource,
        navigate: (resource) => {
          const href = hrefFromResource(resource);
          input.navigate(href);
          return href;
        },
      }),
      ctx.layout.registerWidget({
        id: TICKETS_MAIN_WIDGET_ID,
        title: "Tickets",
        area: "main",
        singleton: true,
        resourceKinds: [TICKETS_RESOURCE_KIND],
        renderer: "react",
        rendererId: TICKETS_MAIN_WIDGET_ID,
      }),
      ctx.resources.registerOpener({
        id: TICKETS_MAIN_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === TICKETS_RESOURCE_KIND,
        open: async (resource, openInput) => {
          await ctx.navigation.navigateResource(resource);
          return ctx.layout.openWidget(TICKETS_MAIN_WIDGET_ID, {
            resource,
            replaceActive: openInput.replaceActive,
            closable: false,
          });
        },
      }),
      ctx.commands.registerCommand(
        {
          id: TICKETS_OPEN_COMMAND_ID,
          label: "Open tickets",
          category: "Tickets",
          description: "Open project tickets",
          icon: TICKETS_ICON,
        },
        {
          execute: () => ctx.resources.openResource(ticketsResource),
        },
      ),
      ctx.commands.registerCommand(
        {
          id: TICKETS_CREATE_COMMAND_ID,
          label: "New ticket",
          category: "Tickets",
          description: "Create a project ticket",
          icon: "Plus",
        },
        {
          execute: input.requestCreateTicket,
        },
      ),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: TICKETS_OPEN_COMMAND_ID,
        label: "Open tickets",
        icon: TICKETS_ICON,
      }),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: TICKETS_CREATE_COMMAND_ID,
        label: "New ticket",
        icon: "Plus",
      }),
      ctx.menus.registerMenuAction(workbenchTopHeaderTrailingMenuPath, {
        commandId: TICKETS_CREATE_COMMAND_ID,
        label: "New ticket",
        icon: "Plus",
        group: "primary",
      }),
    ];
  },
});

export const createDashboardTicketsShell = (input: CreateDashboardTicketsShellInput) => {
  const shell = createDashboardProjectShell({
    projectId: input.projectId,
    projectName: input.projectName,
    navigate: input.navigate,
    requestCreateTicket: input.requestCreateTicket,
    requestCreateSession: input.requestCreateSession,
    openCommandPalette: input.openCommandPalette,
    openShortcutHelp: input.openShortcutHelp,
    storage: input.storage,
  });
  const disposable = activateProductModule(shell, createDashboardTicketsModule(input));

  shell.layout.clearArea("main");
  shell.layout.openWidget(TICKETS_MAIN_WIDGET_ID, {
    resource: createTicketsResource(input.projectId),
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
