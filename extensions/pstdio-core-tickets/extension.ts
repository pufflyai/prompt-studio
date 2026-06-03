import { commandRef, defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import { archiveTicketCommand } from "./src/commands/archive-ticket";
import { attachTicketFileCommand, detachTicketFileCommand } from "./src/commands/attach-ticket-file";
import { createTicketCommand } from "./src/commands/create-ticket";
import { deleteTicketCommand } from "./src/commands/delete-ticket";
import { getTicketCommand } from "./src/commands/get-ticket";
import { queryTicketsCommand } from "./src/commands/query-tickets";
import { setTicketAttributeCommand } from "./src/commands/set-ticket-attribute";
import { breakIntoSubTicketsCommand, refineTicketCommand, runAttemptCommand } from "./src/commands/ticket-actions";
import {
  createTicketFileCommand,
  deleteTicketFileCommand,
  selectTicketFileCommand,
  updateTicketFileCommand,
} from "./src/commands/ticket-files";
import {
  createTicketStatusCommand,
  deleteTicketStatusCommand,
  readTicketStatusesCommand,
  reorderTicketStatusesCommand,
  updateTicketStatusCommand,
} from "./src/commands/ticket-statuses";
import {
  createTagOptionCommand,
  createTicketTagCommand,
  deleteTagOptionCommand,
  deleteTicketTagCommand,
  readTicketTagsCommand,
  setTicketTagsCommand,
  updateTagOptionCommand,
  updateTicketTagCommand,
} from "./src/commands/ticket-tags";
import { updateTicketCommand } from "./src/commands/update-ticket";
import { buildTicketAttributes } from "./src/data/mappers";
import { seedDefaultStatuses, seedDefaultTags } from "./src/data/seed";

export default defineExtension({
  commands: {
    "run-attempt": runAttemptCommand,
    "refine-ticket": refineTicketCommand,
    "break-into-sub-tickets": breakIntoSubTicketsCommand,

    "query-tickets": queryTicketsCommand,
    "create-ticket": createTicketCommand,
    "attach-file": attachTicketFileCommand,
    "detach-file": detachTicketFileCommand,
    "get-ticket": getTicketCommand,
    "update-ticket": updateTicketCommand,
    "create-ticket-file": createTicketFileCommand,
    "update-ticket-file": updateTicketFileCommand,
    "delete-ticket-file": deleteTicketFileCommand,
    "select-ticket-file": selectTicketFileCommand,
    "set-ticket-attribute": setTicketAttributeCommand,
    "archive-ticket": archiveTicketCommand,
    "delete-ticket": deleteTicketCommand,

    "ticketStatus.read": readTicketStatusesCommand,
    "ticketStatus.create": createTicketStatusCommand,
    "ticketStatus.update": updateTicketStatusCommand,
    "ticketStatus.delete": deleteTicketStatusCommand,
    "ticketStatus.reorder": reorderTicketStatusesCommand,

    "set-ticket-tags": setTicketTagsCommand,
    "ticketTag.read": readTicketTagsCommand,
    "ticketTag.create": createTicketTagCommand,
    "ticketTag.update": updateTicketTagCommand,
    "ticketTag.delete": deleteTicketTagCommand,
    "ticketTag.createOption": createTagOptionCommand,
    "ticketTag.updateOption": updateTagOptionCommand,
    "ticketTag.deleteOption": deleteTagOptionCommand,
  },

  settingsPanels: {
    ticketStatuses: {
      title: "Ticket statuses",
      target: "workbench.settings",
      scope: "project",
      webview: {
        entry: packageAsset("./src/views/settings-panel.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
    ticketTags: {
      title: "Ticket tags",
      target: "workbench.settings",
      scope: "project",
      webview: {
        entry: packageAsset("./src/views/tags-settings-panel.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
  },

  dataRenderers: {
    tickets: {
      title: "Tickets",
      resourceKind: "ticket",
      attributes: buildTicketAttributes([]),
      queryCommand: commandRef("pstdio-core-tickets.query-tickets"),
      updateAttributeCommand: commandRef("pstdio-core-tickets.set-ticket-attribute"),
      createRow: {
        command: commandRef("pstdio-core-tickets.create-ticket"),
        columnParam: "statusId",
        title: "New ticket",
        submitLabel: "Create",
      },
      rowActions: [
        {
          id: "run-attempt",
          label: "Run attempt",
          icon: "play",
          command: commandRef("pstdio-core-tickets.run-attempt"),
        },
        {
          id: "refine-ticket",
          label: "Refine ticket",
          icon: "sparkles",
          command: commandRef("pstdio-core-tickets.refine-ticket"),
        },
        {
          id: "break-into-sub-tickets",
          label: "Break into sub-tickets",
          icon: "list-tree",
          command: commandRef("pstdio-core-tickets.break-into-sub-tickets"),
        },
        { id: "archive", label: "Archive", icon: "archive", command: commandRef("pstdio-core-tickets.archive-ticket") },
        {
          id: "delete",
          label: "Delete",
          icon: "trash",
          destructive: true,
          command: commandRef("pstdio-core-tickets.delete-ticket"),
        },
      ],
      defaultSettings: {
        viewMode: "board",
        columnGrouping: "status",
        rowGrouping: "none",
        ordering: { attributeId: "manual", direction: "asc" },
        displayProperties: ["id", "type"],
      },
      emptyTitle: "No tickets yet",
      emptyDescription: "Create a ticket to start tracking work for this project.",
    },
  },

  views: {
    ticketEditor: {
      title: "Ticket",
      resourceKind: "ticket",
      webview: {
        entry: packageAsset("./src/views/ticket-editor.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
    // Files tree, opened in the main-left panel beside the editor (bound to the
    // same ticket). Selecting a file broadcasts over the command feed; the editor
    // listens and opens it.
    ticketFiles: {
      title: "Files",
      resourceKind: "ticket",
      target: "workbench.main.left",
      surface: "panel",
      webview: {
        entry: packageAsset("./src/views/ticket-files-view.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
    // Opens in the workbench right sidepanel alongside the editor, bound to the
    // same ticket resource (the dashboard opens both when a ticket is opened).
    ticketProperties: {
      title: "Properties",
      resourceKind: "ticket",
      target: "workbench.main.right",
      surface: "panel",
      webview: {
        entry: packageAsset("./src/views/ticket-properties.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
    createTicketModal: {
      title: "New ticket",
      resourceKind: "ticket",
      surface: "modal",
      webview: {
        entry: packageAsset("./src/views/create-ticket-modal.tsx", import.meta.url),
        capabilities: ["commands.execute", "notification.show", "files.upload", "files.list", "files.delete"],
      },
    },
  },

  async initialSetup(ctx) {
    await seedDefaultStatuses(ctx.storage);
    await seedDefaultTags(ctx.storage);
  },

  templateTypes: {
    ticket: {
      label: "Ticket",
      description: "Ticket templates",
    },
    prompt: {
      label: "Prompt",
      description: "Prompt templates",
    },
  },

  templates: {
    ticket: {
      title: "Ticket",
      type: "ticket",
      source: packageAsset("./templates/tickets/ticket.ticket.md", import.meta.url),
    },
    bug_fix: {
      title: "Bug fix",
      type: "ticket",
      source: packageAsset("./templates/tickets/bug-fix.ticket.md", import.meta.url),
    },
    proposal: {
      title: "Proposal",
      type: "ticket",
      source: packageAsset("./templates/tickets/proposal.ticket.md", import.meta.url),
    },
    create_sub_tickets: {
      title: "Create sub-tickets",
      type: "prompt",
      source: packageAsset("./templates/prompts/create-sub-tickets.prompt.md", import.meta.url),
    },
    implement_ticket: {
      title: "Implement ticket",
      type: "prompt",
      source: packageAsset("./templates/prompts/implement-ticket.prompt.md", import.meta.url),
    },
    refine_ticket: {
      title: "Refine ticket",
      type: "prompt",
      source: packageAsset("./templates/prompts/refine-ticket.prompt.md", import.meta.url),
    },
    fix_changes_requested: {
      title: "Fix changes requested",
      type: "prompt",
      source: packageAsset("./templates/prompts/fix-changes-requested.prompt.md", import.meta.url),
    },
    review_code: {
      title: "Review code",
      type: "prompt",
      source: packageAsset("./templates/prompts/review-code.prompt.md", import.meta.url),
    },
  },

  skills: {
    create_proposal: { title: "Create a proposal", source: packageAsset("./skills/create-proposal", import.meta.url) },
    create_sub_tickets: {
      title: "Create sub-tickets",
      source: packageAsset("./skills/create-sub-tickets", import.meta.url),
    },
    create_ticket: {
      title: "Create a ticket",
      source: packageAsset("./skills/create-ticket", import.meta.url),
    },
    implement_ticket: {
      title: "Implement a ticket",
      source: packageAsset("./skills/implement-ticket", import.meta.url),
    },
    refine_ticket: {
      title: "Refine a ticket",
      source: packageAsset("./skills/refine-ticket", import.meta.url),
    },
  },
});
