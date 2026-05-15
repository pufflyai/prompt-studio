import {
  type ProductModuleContribution,
  type ProductModuleContributionContext,
  type ResourceRef,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-shell/core";
import { PROJECT_CONTEXT_WHEN } from "../dashboard-project-chrome";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "../menu-locations";

export const TICKETS_RESOURCE_KIND = "tickets";
export const TICKETS_MAIN_WIDGET_ID = "tickets.main";
export const TICKETS_OPEN_COMMAND_ID = "tickets.open";
export const TICKETS_CREATE_COMMAND_ID = "tickets.create";
export const TICKETS_NAVIGATION_PARSER_ID = "dashboard.ticketsUri";
export const TICKETS_NAVIGATOR_ID = "dashboard.ticketsRouter";

const TICKETS_ICON = "KanbanSquare";
const TICKETS_CONTRIBUTION_PRIORITY = 200;

interface CreateDashboardTicketsModuleInput {
  navigate: (path: string) => void;
  requestCreateTicket: () => void;
}

const readProjectId = (ctx: ProductModuleContributionContext) => {
  const projectId = ctx.context.get("projectId");
  return typeof projectId === "string" ? projectId : "";
};

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

export const createDashboardTicketsModule = (input: CreateDashboardTicketsModuleInput): ProductModuleContribution => ({
  id: "dashboard.tickets",
  activate(ctx) {
    return [
      ctx.resources.registerKind({ kind: TICKETS_RESOURCE_KIND, label: "Tickets", icon: TICKETS_ICON }),
      ctx.navigation.registerParser({
        id: TICKETS_NAVIGATION_PARSER_ID,
        priority: TICKETS_CONTRIBUTION_PRIORITY,
        canParse: (location) => parseTicketsUri(location) !== null,
        parse: (location) => {
          const parsed = parseTicketsUri(location);
          return createTicketsResource(parsed?.projectId ?? readProjectId(ctx));
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
          execute: () => ctx.resources.openResource(createTicketsResource(readProjectId(ctx))),
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
        when: PROJECT_CONTEXT_WHEN,
      }),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: TICKETS_CREATE_COMMAND_ID,
        label: "New ticket",
        icon: "Plus",
        when: PROJECT_CONTEXT_WHEN,
      }),
      ctx.menus.registerMenuAction(workbenchTopHeaderTrailingMenuPath, {
        commandId: TICKETS_CREATE_COMMAND_ID,
        label: "New ticket",
        icon: "Plus",
        group: "primary",
        when: PROJECT_CONTEXT_WHEN,
      }),
    ];
  },
});
