import {
  defineNavigationItem,
  defineNavigationTree,
  defineSettingsPanel,
  defineSettingsSection,
  defineView,
  defineViewMenu,
  l10n,
  packageAsset,
  viewDataEvents,
  workbenchModes,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { archiveTicketColumnAction } from "./commands/archive-ticket";
import { attachTicketFileCommand } from "./commands/attach-ticket-file";
import { createTicketCommand } from "./commands/create-ticket";
import { getTicketContent } from "./commands/get-ticket-content";
import { moveTicketOnBoard } from "./commands/move-ticket-on-board";
import { queryTickets } from "./commands/query-tickets";
import { saveTicketContent } from "./commands/save-ticket-content";
import { setTicketAttribute } from "./commands/set-ticket-attribute";
import { listTicketFilesTree } from "./commands/ticket-files";
import { queryTicketProperties } from "./commands/ticket-properties/query";
import { updateTicketProperty } from "./commands/ticket-properties/update";
import { buildTicketAttributes, TICKET_ARCHIVE_STATE_ACTIVE, TICKET_ARCHIVE_STATE_ATTRIBUTE_ID } from "./data/mappers";
import { hasPendingInput, listTicketReviewRequests } from "./data/review-request-storage";
import { REVIEW_REQUEST_ICON } from "./data/review-request-summary";
import { DEFAULT_TIMELINE_DISPLAY_PROPERTIES, ticketBoard, timelineBoard } from "./data/ticket-board";
import { ticketActivationTarget } from "./data/ticket-page-target";
import { plannerSchemaChanged, plannerTicketsChanged } from "./events";
import { ticketCreateForm } from "./ticket-create-form";
import { ticketNavigationStructure } from "./ticket-navigation-structure";
import { createTicketPages } from "./ticket-pages";
import { timelineViewSchema } from "./timeline/commands/view-schema";
import { planChanged } from "./timeline/contracts";
import { queryWorkflowSettings, saveWorkflowSettings } from "./views/workflow-settings";

export { ticketResourceKind } from "./resource-kinds";

const createTagSettingsView = (baseUrl: string) =>
  defineView({
    id: "ticket-tags-settings",
    title: l10n("settingsPanels.ticketTags.title", "Ticket tags"),
    icon: "tag",
    body: {
      kind: "webview",
      entry: packageAsset("./src/views/tags-settings-panel.tsx", baseUrl),
      capabilities: ["commands.execute"],
    },
  });
export const createPlannerUi = (baseUrl: string) => {
  const tagSettings = createTagSettingsView(baseUrl);
  const settingsSection = defineSettingsSection({ id: "planner", title: "Project Planner", order: 25 });
  const statusSettings = defineView({
    id: "ticket-status-settings",
    title: "Ticket status",
    icon: "status-progress",
    body: {
      kind: "webview",
      entry: packageAsset("./src/views/status-settings-panel.tsx", baseUrl),
      capabilities: ["commands.execute"],
    },
  });
  const workflowSettings = defineView({
    id: "workflow-settings",
    title: l10n("views.workflowSettings.title", "Planner workflow"),
    body: {
      kind: "controls",
      query: queryWorkflowSettings,
      onValueChange: (ctx, input) => saveWorkflowSettings(ctx, input.values),
      refreshEvents: [plannerTicketsChanged],
    },
  });
  const requests = defineView({
    id: "ticket-requests",
    title: l10n("requests.view.title", "Needs attention"),
    icon: REVIEW_REQUEST_ICON,
    body: {
      kind: "webview",
      entry: packageAsset("./src/views/ticket-review-requests.tsx", baseUrl),
      capabilities: ["commands.execute"],
    },
  });
  const tickets = defineView({
    id: ticketBoard.id,
    title: l10n("kanbanRenderers.tickets.title", "Tickets"),
    icon: "square-kanban",
    body: {
      kind: "kanban",
      attributes: buildTicketAttributes([]),
      query: queryTickets,
      schemaRefreshEvents: [plannerSchemaChanged],
      refreshEvents: [
        plannerTicketsChanged,
        planChanged,
        viewDataEvents.sessionsChanged,
        viewDataEvents.workspacesChanged,
      ],
      onRowActivate: async (ctx, { row }) => {
        if (!row.resource) return;
        const pending = hasPendingInput(await listTicketReviewRequests(ctx.storage, row.resource.id));
        ctx.navigation.open(ticketActivationTarget(row.resource, pending));
      },
      onAttributeChange: setTicketAttribute,
      onMove: moveTicketOnBoard,
      onColumnAction: archiveTicketColumnAction,
      defaultFilter: {
        conjunction: "and",
        rules: [
          {
            attributeId: TICKET_ARCHIVE_STATE_ATTRIBUTE_ID,
            condition: "is-any-of",
            value: [TICKET_ARCHIVE_STATE_ACTIVE],
          },
        ],
      },
      defaultSorts: [{ attributeId: "created", direction: "desc" }],
      createRow: {
        command: createTicketCommand.ref,
        columnParam: "statusId",
        ...ticketCreateForm,
        attributesParam: "attributes",
        attachments: {
          command: attachTicketFileCommand.ref,
          resourceParam: "ticketId",
          fileParam: "ref",
        },
      },
      defaultSettings: {
        viewMode: "board",
        columnGrouping: "status",
        rowGrouping: "none",
        displayProperties: ["id", "workspace", "type", "priority", "needsAttention"],
      },
      emptyTitle: l10n("kanbanRenderers.tickets.emptyTitle", "No tickets yet"),
      emptyDescription: l10n(
        "kanbanRenderers.tickets.emptyDescription",
        "Create a ticket to start tracking work for this project.",
      ),
    },
  });
  const timelineTickets = defineView({
    id: timelineBoard.id,
    title: l10n("timeline.page.title", "Project Timeline"),
    icon: "chart-no-axes-gantt",
    body: {
      ...tickets.body,
      query: timelineViewSchema,
      defaultSettings: { ...tickets.body.defaultSettings, displayProperties: DEFAULT_TIMELINE_DISPLAY_PROPERTIES },
    },
  });
  const editor = defineView({
    id: "ticket-editor",
    title: l10n("panels.ticketEditor.title", "Ticket"),
    body: {
      kind: "file",
      load: (ctx, input) => getTicketContent(ctx, { resource: input.renderer.resource }),
      refreshEvents: [plannerTicketsChanged],
      save: (ctx, input) => saveTicketContent(ctx, { content: input.content, resource: input.renderer.resource }),
    },
  });
  const files = defineView({
    id: "ticket-files",
    title: l10n("panels.ticketFiles.title", "Files"),
    icon: "Files",
    body: {
      kind: "tree",
      structure: ticketNavigationStructure,
      body: listTicketFilesTree,
      refreshEvents: [plannerTicketsChanged, viewDataEvents.sessionsChanged, viewDataEvents.workspacesChanged],
      defaultExpandedSectionIds: ["files", "sub-tickets", "workspaces", "sessions"],
    },
  });
  const properties = defineView({
    id: "ticket-properties",
    title: l10n("controls.ticketProperties.title", "Properties"),
    body: {
      kind: "controls",
      query: (ctx, input) => queryTicketProperties(ctx, input.renderer.resource),
      onValueChange: (ctx, input) => updateTicketProperty(ctx, input.renderer.resource, input),
      refreshEvents: [plannerTicketsChanged, planChanged],
      emptyTitle: l10n("controls.ticketProperties.emptyTitle", "No ticket selected"),
    },
  });
  const { ticketDetailPage, ticketsPage, ticketBoardPanel, requestsPage } = createTicketPages(
    tickets.ref,
    editor.ref,
    requests.ref,
  );
  return {
    views: [
      statusSettings,
      tickets,
      timelineTickets,
      editor,
      files,
      properties,
      tagSettings,
      requests,
      workflowSettings,
    ],
    pages: [ticketsPage, ticketDetailPage, requestsPage],
    placements: [ticketBoardPanel],
    viewMenus: [
      defineViewMenu({
        id: "ticket.properties",
        owner: editor.ref,
        view: properties.ref,
        side: "right",
      }),
    ],
    navigationItems: [
      defineNavigationItem({
        id: "tickets",
        owner: workbenchModes.project,
        slot: "content",
        label: l10n("kanbanRenderers.tickets.title", "Tickets"),
        icon: "square-kanban",
        group: "Project Planning",
        action: { kind: "page", page: ticketsPage.ref },
      }),
    ],
    navigationTrees: [
      defineNavigationTree({
        id: "ticket-files",
        owner: ticketDetailPage.ref,
        slot: "content",
        view: files.ref,
      }),
      defineNavigationTree({
        id: "ticket-requests-files",
        owner: requestsPage.ref,
        slot: "content",
        view: files.ref,
      }),
    ],
    settingsSections: [settingsSection],
    settingsPanels: [
      defineSettingsPanel({
        id: "ticket-status",
        view: statusSettings.ref,
        slot: workbenchSlots.projectSettings,
        section: settingsSection.ref,
      }),
      defineSettingsPanel({
        id: "workflow-settings",
        view: workflowSettings.ref,
        slot: workbenchSlots.extensionSettings,
      }),
      defineSettingsPanel({
        id: "ticket-tags",
        view: tagSettings.ref,
        slot: workbenchSlots.projectSettings,
        section: settingsSection.ref,
      }),
    ],
  };
};
