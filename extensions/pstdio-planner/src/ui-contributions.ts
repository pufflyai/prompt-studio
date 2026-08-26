import {
  defineNavigationItem,
  definePlacement,
  defineResourceKind,
  defineResourceView,
  defineSettingsPanel,
  defineSettingsSection,
  defineView,
  defineViewMenu,
  l10n,
  packageAsset,
  resourceSlotRef,
  workbenchModes,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { archiveTicketColumnAction, archiveTicketCommand } from "./commands/archive-ticket";
import { attachTicketFileCommand } from "./commands/attach-ticket-file";
import { createTicketCommand } from "./commands/create-ticket";
import { deleteTicketCommand } from "./commands/delete-ticket";
import { getTicketContent } from "./commands/get-ticket-content";
import { queryTickets } from "./commands/query-tickets";
import { reorderTicket } from "./commands/reorder-ticket";
import { runAttemptCommand } from "./commands/run-attempt";
import { saveTicketContent } from "./commands/save-ticket-content";
import { setTicketAttribute } from "./commands/set-ticket-attribute";
import { breakIntoSubTicketsCommand, createWorkspaceCommand, refineTicketCommand } from "./commands/ticket-actions";
import { listTicketFilesTree } from "./commands/ticket-files";
import { queryTicketProperties } from "./commands/ticket-properties/query";
import { updateTicketProperty } from "./commands/ticket-properties/update";
import { buildTicketAttributes, TICKET_ARCHIVE_STATE_ACTIVE, TICKET_ARCHIVE_STATE_ATTRIBUTE_ID } from "./data/mappers";
import { plannerTicketsChanged } from "./events";
import { ticketStatuses } from "./ticket-status-provider";

export const ticketResourceKind = defineResourceKind({
  id: "ticket",
  surface: "primary",
  label: l10n("resourceKinds.ticket.label", "Ticket"),
  icon: "component",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "navigation", cardinality: "one", access: "public" },
  ],
});

export const plannerSettingsSection = defineSettingsSection({
  id: "planner",
  title: l10n("settingsSections.planner.title", "Planner"),
  order: 40,
});

const ticketPrimary = resourceSlotRef(ticketResourceKind.ref, "primary");
const ticketNavigation = resourceSlotRef(ticketResourceKind.ref, "navigation");

export const createPlannerUi = (baseUrl: string) => {
  const tickets = defineView({
    id: "tickets",
    title: l10n("kanbanRenderers.tickets.title", "Tickets"),
    icon: "square-kanban",
    path: "tickets",
    body: {
      kind: "kanban",
      attributes: buildTicketAttributes(ticketStatuses.ref),
      query: queryTickets,
      refreshEvents: [plannerTicketsChanged],
      onRowActivate: (_ctx, { row }) =>
        row.resource ? { kind: "resource", resource: row.resource, input: { strategy: "replace-active" } } : undefined,
      onAttributeChange: setTicketAttribute,
      onReorder: reorderTicket,
      onColumnAction: archiveTicketColumnAction,
      defaultFilters: { [TICKET_ARCHIVE_STATE_ATTRIBUTE_ID]: [TICKET_ARCHIVE_STATE_ACTIVE] },
      createRow: {
        command: createTicketCommand.ref,
        columnParam: "statusId",
        title: l10n("kanbanRenderers.tickets.createRow.title", "New ticket"),
        submitLabel: l10n("kanbanRenderers.tickets.createRow.submitLabel", "Create ticket"),
        params: {
          content: {
            type: "markdown",
            label: l10n("kanbanRenderers.tickets.createRow.content.label", "Description"),
            placeholder: l10n("kanbanRenderers.tickets.createRow.content.placeholder", "Describe the ticket..."),
            required: true,
          },
          files: {
            type: "files",
            label: l10n("kanbanRenderers.tickets.createRow.attachments.label", "Attach files"),
            multiple: true,
          },
        },
        attributesParam: "attributes",
        attachments: {
          command: attachTicketFileCommand.ref,
          resourceParam: "ticketId",
          fileParam: "ref",
        },
        labels: {
          cancel: l10n("kanbanRenderers.tickets.createRow.cancel", "Cancel"),
          properties: l10n("kanbanRenderers.tickets.createRow.properties", "Properties"),
          submitError: l10n("kanbanRenderers.tickets.createRow.submitError", "Could not create ticket"),
          removeFile: l10n("kanbanRenderers.tickets.createRow.removeFile", "Remove file"),
        },
      },
      rowActions: [
        {
          id: "create-workspace",
          label: l10n("kanbanRenderers.tickets.rowActions.createWorkspace", "Create workspace"),
          icon: "git-branch",
          command: createWorkspaceCommand.ref,
        },
        {
          id: "run-attempt",
          label: l10n("kanbanRenderers.tickets.rowActions.runAttempt", "Run attempt"),
          icon: "play",
          command: runAttemptCommand.ref,
        },
        {
          id: "refine-ticket",
          label: l10n("kanbanRenderers.tickets.rowActions.refineTicket", "Refine ticket"),
          icon: "sparkles",
          command: refineTicketCommand.ref,
        },
        {
          id: "break-into-sub-tickets",
          label: l10n("kanbanRenderers.tickets.rowActions.breakIntoSubTickets", "Break into sub-tickets"),
          icon: "list-tree",
          command: breakIntoSubTicketsCommand.ref,
        },
        {
          id: "archive",
          label: l10n("kanbanRenderers.tickets.rowActions.archive", "Archive"),
          icon: "archive",
          command: archiveTicketCommand.ref,
        },
        {
          id: "delete",
          label: l10n("kanbanRenderers.tickets.rowActions.delete", "Delete"),
          icon: "trash",
          destructive: true,
          command: deleteTicketCommand.ref,
        },
      ],
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
      refreshEvents: [plannerTicketsChanged],
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
  const tagSettings = defineView({
    id: "ticket-tags-settings",
    title: l10n("settingsPanels.ticketTags.title", "Ticket tags"),
    icon: "tag",
    body: {
      kind: "webview",
      entry: packageAsset("./src/views/tags-settings-panel.tsx", baseUrl),
      capabilities: ["commands.execute"],
    },
  });

  return {
    views: [tickets, editor, files, properties, tagSettings],
    resourceViews: [
      defineResourceView({
        id: "ticket-editor",
        resourceKind: ticketResourceKind.ref,
        slot: ticketPrimary,
        view: editor.ref,
      }),
      defineResourceView({
        id: "ticket-files",
        resourceKind: ticketResourceKind.ref,
        slot: ticketNavigation,
        view: files.ref,
      }),
    ],
    viewMenus: [
      defineViewMenu({
        id: "ticket.properties",
        owner: editor.ref,
        view: properties.ref,
        side: "right",
      }),
    ],
    placements: [
      definePlacement({
        id: "tickets.project",
        mode: workbenchModes.project,
        item: { kind: "view", view: tickets.ref },
        region: "main",
      }),
      definePlacement({
        id: "ticket-primary.project",
        mode: workbenchModes.project,
        item: { kind: "resource-slot", slot: ticketPrimary },
        region: "main",
        required: true,
      }),
      definePlacement({
        id: "ticket-navigation.project",
        mode: workbenchModes.project,
        item: { kind: "resource-slot", slot: ticketNavigation },
        region: "sidenav",
        required: true,
      }),
    ],
    navigationItems: [
      defineNavigationItem({
        id: "tickets",
        slot: workbenchSlots.projectNavigation,
        label: l10n("kanbanRenderers.tickets.title", "Tickets"),
        icon: "square-kanban",
        group: "",
        order: -100,
        action: { kind: "view", view: tickets.ref },
      }),
    ],
    settingsPanels: [
      defineSettingsPanel({
        id: "ticket-tags",
        view: tagSettings.ref,
        slot: workbenchSlots.projectSettings,
        section: plannerSettingsSection.ref,
      }),
    ],
  };
};
