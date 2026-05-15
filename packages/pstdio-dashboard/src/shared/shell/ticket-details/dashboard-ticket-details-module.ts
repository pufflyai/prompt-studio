import type {
  ResourceRef,
  ShellModeContribution,
  ShellModuleContribution,
  ShellModuleContributionContext,
  TreeViewSection,
} from "pstdio-shell/core";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "../menu-locations";

export const TICKET_DETAILS_RESOURCE_KIND = "ticket";
export const PROJECT_TICKET_DETAILS_MODE_ID = "project.ticket-details";
export const TICKET_DETAILS_NAVIGATION_TREE_ID = "ticket.details.navigation";
export const TICKET_DETAILS_NAVIGATION_RESOURCE_KIND = "ticket.details.navigation-resource";
export const TICKET_DETAILS_NAVIGATION_OPENER_ID = "ticket.details.navigationOpener";
export const TICKET_DETAILS_MAIN_WIDGET_ID = "ticket.details.main";
export const TICKET_DETAILS_OPEN_COMMAND_ID = "ticket.details.open";
export const TICKET_DETAILS_NAVIGATION_PARSER_ID = "dashboard.ticketDetailsUri";
export const TICKET_DETAILS_NAVIGATOR_ID = "dashboard.ticketDetailsRouter";

const TICKET_DETAILS_ICON = "FileText";
const TICKET_DETAILS_CONTRIBUTION_PRIORITY = 220;

export interface DashboardTicketDetailsNavigationState {
  getSections: () => TreeViewSection[];
  openResource: (resource: ResourceRef) => void;
}

export interface DashboardTicketDetailsNavigationController {
  current: DashboardTicketDetailsNavigationState;
}

interface CreateDashboardTicketDetailsModuleInput {
  navigate: (path: string) => void;
  navigation: DashboardTicketDetailsNavigationController;
}

const readContextString = (ctx: ShellModuleContributionContext, key: string) => {
  const value = ctx.context.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const readProjectId = (ctx: ShellModuleContributionContext) => readContextString(ctx, "projectId") ?? "";

const readTicketId = (ctx: ShellModuleContributionContext) => readContextString(ctx, "ticketId") ?? "ticket";

export const createEmptyTicketDetailsNavigationState = () =>
  ({ getSections: () => [], openResource: () => undefined }) satisfies DashboardTicketDetailsNavigationState;

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

const createActiveTicketDetailsResource = (ctx: ShellModuleContributionContext) =>
  createTicketDetailsResource(readProjectId(ctx), readTicketId(ctx));

export const createDashboardTicketDetailsModule = (
  input: CreateDashboardTicketDetailsModuleInput,
): ShellModuleContribution => ({
  id: "dashboard.ticketDetails",
  activate(ctx) {
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
          if (!parsed) return createActiveTicketDetailsResource(ctx);

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
          execute: () => ctx.resources.openResource(createActiveTicketDetailsResource(ctx)),
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

export const createProjectTicketDetailsMode = (input: {
  navigation: DashboardTicketDetailsNavigationController;
}): ShellModeContribution => ({
  id: PROJECT_TICKET_DETAILS_MODE_ID,
  label: "Ticket",
  activate(ctx) {
    ctx.layout.clearArea("left-header");
    ctx.layout.clearArea("main");
    ctx.layout.openWidget(TICKET_DETAILS_MAIN_WIDGET_ID, {
      resource: createActiveTicketDetailsResource(ctx),
      closable: false,
    });

    return ctx.trees.registerTreeView({
      id: TICKET_DETAILS_NAVIGATION_TREE_ID,
      title: "Ticket navigation",
      area: "left",
      areaSize: { defaultPx: 240, minPx: 200 },
      icon: TICKET_DETAILS_ICON,
      defaultExpandedSectionIds: ["files", "sub-tickets", "workspaces", "sessions"],
      getRoots: () => [],
      getChildren: () => [],
      getSections: () => input.navigation.current.getSections(),
    });
  },
});
