import {
  activateProductModule,
  type ProductModuleContribution,
  type ResourceRef,
  type TreeViewSection,
} from "pstdio-shell/core";
import type { MutableRefObject } from "react";
import { createDashboardProjectShell } from "./dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const TICKET_DETAILS_RESOURCE_KIND = "ticket";
export const TICKET_DETAILS_MODE_ID = "ticket";
export const TICKET_DETAILS_NAVIGATION_TREE_ID = "ticket.details.navigation";
export const TICKET_DETAILS_NAVIGATION_RESOURCE_KIND = "ticket.details.navigation-resource";
export const TICKET_DETAILS_NAVIGATION_OPENER_ID = "ticket.details.navigationOpener";
export const TICKET_DETAILS_MAIN_WIDGET_ID = "ticket.details.main";
export const TICKET_DETAILS_OPEN_COMMAND_ID = "ticket.details.open";
export const TICKET_DETAILS_NAVIGATION_PARSER_ID = "dashboard.ticketDetailsUri";
export const TICKET_DETAILS_NAVIGATOR_ID = "dashboard.ticketDetailsRouter";

const TICKET_DETAILS_ICON = "FileText";
const TICKET_DETAILS_CONTRIBUTION_PRIORITY = 220;

interface CreateDashboardTicketDetailsShellInput {
  projectId: string;
  projectName: string;
  ticketShorthand: string;
  ticketTitle?: string | null;
  navigation: MutableRefObject<DashboardTicketDetailsNavigationState>;
  navigate: (path: string) => void;
}

export interface DashboardTicketDetailsNavigationState {
  getSections: () => TreeViewSection[];
  openResource: (resource: ResourceRef) => void;
}

export const createTicketDetailsResource = (
  projectId: string,
  ticketShorthand: string,
  ticketTitle?: string | null,
): ResourceRef => ({
  kind: TICKET_DETAILS_RESOURCE_KIND,
  uri: `pstdio://project/${projectId}/ticket/${ticketShorthand}`,
  id: ticketShorthand,
  label: ticketTitle ? `${ticketShorthand} ${ticketTitle}` : ticketShorthand,
  icon: TICKET_DETAILS_ICON,
});

export const createTicketDetailsNavigationResource = (
  projectId: string,
  ticketShorthand: string,
  id: string,
  label: string,
  metadata: Record<string, unknown>,
): ResourceRef => ({
  kind: TICKET_DETAILS_NAVIGATION_RESOURCE_KIND,
  uri: `pstdio://project/${projectId}/ticket/${ticketShorthand}/navigation/${encodeURIComponent(id)}`,
  id,
  label,
  metadata,
});

const parseTicketDetailsUri = (uri: string) => {
  const match = uri.match(/^pstdio:\/\/project\/([^/]+)\/ticket\/([^/]+)$/);
  if (!match) return null;

  return { projectId: match[1], ticketShorthand: match[2] };
};

const createTicketDetailsHref = (projectId: string, ticketShorthand: string) =>
  `/projects/${projectId}/tickets/${ticketShorthand}`;

const hrefFromResource = (resource: ResourceRef) => {
  const parsed = parseTicketDetailsUri(resource.uri);
  return parsed ? createTicketDetailsHref(parsed.projectId, parsed.ticketShorthand) : "/";
};

const createInitialTicketResource = (input: CreateDashboardTicketDetailsShellInput) =>
  createTicketDetailsResource(input.projectId, input.ticketShorthand, input.ticketTitle);

const createDashboardTicketDetailsModule = (
  input: CreateDashboardTicketDetailsShellInput,
): ProductModuleContribution => ({
  id: "dashboard.ticketDetails",
  activate(ctx) {
    const ticketResource = createInitialTicketResource(input);

    return [
      ctx.resources.registerKind({
        kind: TICKET_DETAILS_RESOURCE_KIND,
        label: "Ticket",
        icon: TICKET_DETAILS_ICON,
      }),
      ctx.resources.registerKind({
        kind: TICKET_DETAILS_NAVIGATION_RESOURCE_KIND,
        label: "Ticket navigation item",
        icon: TICKET_DETAILS_ICON,
      }),
      ctx.navigation.registerParser({
        id: TICKET_DETAILS_NAVIGATION_PARSER_ID,
        priority: TICKET_DETAILS_CONTRIBUTION_PRIORITY,
        canParse: (location) => parseTicketDetailsUri(location) !== null,
        parse: (location) => {
          const parsed = parseTicketDetailsUri(location);
          if (!parsed) return ticketResource;

          return createTicketDetailsResource(parsed.projectId, parsed.ticketShorthand);
        },
      }),
      ctx.navigation.registerNavigator({
        id: TICKET_DETAILS_NAVIGATOR_ID,
        priority: TICKET_DETAILS_CONTRIBUTION_PRIORITY,
        canNavigate: (resource) => resource.kind === TICKET_DETAILS_RESOURCE_KIND,
        createHref: hrefFromResource,
        navigate: (resource) => {
          const href = hrefFromResource(resource);
          input.navigate(href);
          return href;
        },
      }),
      ctx.modes.registerMode({
        id: TICKET_DETAILS_MODE_ID,
        label: "Ticket",
        activate: (modeCtx) =>
          modeCtx.trees.registerTreeView({
            id: TICKET_DETAILS_NAVIGATION_TREE_ID,
            title: "Ticket navigation",
            area: "left",
            areaSize: { defaultPx: 240, minPx: 200 },
            icon: TICKET_DETAILS_ICON,
            defaultExpandedSectionIds: ["files", "sub-tickets", "workspaces", "sessions"],
            getRoots: () => [],
            getChildren: () => [],
            getSections: () => input.navigation.current.getSections(),
          }),
      }),
      ctx.layout.registerWidget({
        id: TICKET_DETAILS_MAIN_WIDGET_ID,
        title: "Ticket",
        area: "main",
        singleton: true,
        resourceKinds: [TICKET_DETAILS_RESOURCE_KIND],
        renderer: "react",
        rendererId: TICKET_DETAILS_MAIN_WIDGET_ID,
      }),
      ctx.resources.registerOpener({
        id: TICKET_DETAILS_MAIN_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === TICKET_DETAILS_RESOURCE_KIND,
        open: async (resource, openInput) => {
          await ctx.navigation.navigateResource(resource);
          return ctx.layout.openWidget(TICKET_DETAILS_MAIN_WIDGET_ID, {
            resource,
            replaceActive: openInput.replaceActive,
            closable: false,
          });
        },
      }),
      ctx.resources.registerOpener({
        id: TICKET_DETAILS_NAVIGATION_OPENER_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === TICKET_DETAILS_NAVIGATION_RESOURCE_KIND,
        open: (resource) => input.navigation.current.openResource(resource),
      }),
      ctx.commands.registerCommand(
        {
          id: TICKET_DETAILS_OPEN_COMMAND_ID,
          label: "Open ticket",
          category: "Tickets",
          description: "Open the selected ticket",
          icon: TICKET_DETAILS_ICON,
        },
        {
          execute: () => ctx.resources.openResource(ticketResource),
        },
      ),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: TICKET_DETAILS_OPEN_COMMAND_ID,
        label: "Open ticket",
        icon: TICKET_DETAILS_ICON,
      }),
    ];
  },
});

export const createDashboardTicketDetailsShell = (input: CreateDashboardTicketDetailsShellInput) => {
  const shell = createDashboardProjectShell({
    projectId: input.projectId,
    projectName: input.projectName,
    navigate: input.navigate,
    showProjectNavigationTree: false,
  });
  const disposable = activateProductModule(shell, createDashboardTicketDetailsModule(input));

  shell.modes.setActiveMode(TICKET_DETAILS_MODE_ID);
  shell.layout.openWidget(TICKET_DETAILS_MAIN_WIDGET_ID, {
    resource: createInitialTicketResource(input),
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
