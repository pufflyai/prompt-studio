import type { ViewRef } from "@pstdio/sdk/extensions";
import {
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  defineSettingsPanel,
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
import { queryTickets } from "./commands/query-tickets";
import { reorderTicket } from "./commands/reorder-ticket";
import { saveTicketContent } from "./commands/save-ticket-content";
import { setTicketAttribute } from "./commands/set-ticket-attribute";
import { listTicketFilesTree } from "./commands/ticket-files";
import { queryTicketProperties } from "./commands/ticket-properties/query";
import { updateTicketProperty } from "./commands/ticket-properties/update";
import { buildTicketAttributes, TICKET_ARCHIVE_STATE_ACTIVE, TICKET_ARCHIVE_STATE_ATTRIBUTE_ID } from "./data/mappers";
import { ticketBoard } from "./data/ticket-board";
import { ticketDocumentPage, ticketPageTarget } from "./data/ticket-page-target";
import { plannerTicketsChanged } from "./events";
import { ticketResourceKind } from "./resource-kinds";
import { ticketCreateForm } from "./ticket-create-form";
import { ticketStatuses } from "./ticket-status-provider";

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
const createTicketPages = (tickets: ViewRef, editor: ViewRef) => {
  const ticketsPage = definePage({
    id: "tickets",
    title: l10n("kanbanRenderers.tickets.title", "Tickets"),
    icon: "square-kanban",
    path: "tickets",
    mode: workbenchModes.project,
    main: {
      kind: "view",
      view: tickets,
      cardinality: "one",
    },
    slots: [],
  });
  const ticketDetailPage = definePage({
    id: ticketDocumentPage.id,
    title: l10n("panels.ticketEditor.title", "Ticket"),
    icon: "component",
    path: ticketDocumentPage.path,
    document: ticketDocumentPage.document,
    mode: workbenchModes.project,
    parent: ticketsPage.ref,
    resource: {
      kinds: [ticketResourceKind.ref],
    },
    main: {
      kind: "view",
      view: editor,
      cardinality: "one",
    },
    slots: [],
  });
  return { ticketDetailPage, ticketsPage };
};
export const createPlannerUi = (baseUrl: string) => {
  const tagSettings = createTagSettingsView(baseUrl);
  const documentLink = defineView({
    id: "document-link",
    title: l10n("ticketDocument.copyLink", "Copy Link"),
    icon: "link",
    body: {
      kind: "webview",
      entry: packageAsset("./src/views/document-link.tsx", baseUrl),
      capabilities: ["commands.execute", "clipboard.write"],
    },
  });
  const tickets = defineView({
    id: ticketBoard.id,
    title: l10n("kanbanRenderers.tickets.title", "Tickets"),
    icon: "square-kanban",
    body: {
      kind: "kanban",
      attributes: buildTicketAttributes(ticketStatuses.ref),
      query: queryTickets,
      refreshEvents: [plannerTicketsChanged, viewDataEvents.sessionsChanged, viewDataEvents.workspacesChanged],
      onRowActivate: (ctx, { row }) => {
        if (row.resource) ctx.navigation.open(ticketPageTarget(row.resource));
      },
      onAttributeChange: setTicketAttribute,
      onReorder: reorderTicket,
      onColumnAction: archiveTicketColumnAction,
      defaultFilters: { [TICKET_ARCHIVE_STATE_ATTRIBUTE_ID]: [TICKET_ARCHIVE_STATE_ACTIVE] },
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
        ordering: { attributeId: "created", direction: "desc" },
        displayProperties: ["id", "workspace", "type", "priority"],
      },
      emptyTitle: l10n("kanbanRenderers.tickets.emptyTitle", "No tickets yet"),
      emptyDescription: l10n(
        "kanbanRenderers.tickets.emptyDescription",
        "Create a ticket to start tracking work for this project.",
      ),
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
      refreshEvents: [plannerTicketsChanged],
      emptyTitle: l10n("controls.ticketProperties.emptyTitle", "No ticket selected"),
    },
  });
  const { ticketDetailPage, ticketsPage } = createTicketPages(tickets.ref, editor.ref);
  return {
    views: [tickets, editor, files, properties, tagSettings, documentLink],
    pages: [ticketsPage, ticketDetailPage],
    viewMenus: [
      defineViewMenu({
        id: "ticket.document-link",
        owner: editor.ref,
        view: documentLink.ref,
        side: "left",
      }),
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
    ],
    // No section: the host lists Ticket tags in its Project group, next to Statuses.
    settingsPanels: [
      defineSettingsPanel({
        id: "ticket-tags",
        view: tagSettings.ref,
        slot: workbenchSlots.projectSettings,
      }),
    ],
  };
};
