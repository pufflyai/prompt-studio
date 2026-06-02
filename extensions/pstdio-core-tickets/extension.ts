import { commandRef, defineExtension, packageAsset, params } from "@pstdio/sdk/extensions";
import { archiveTicketCommand } from "./src/commands/archive-ticket";
import { attachTicketFileCommand, detachTicketFileCommand } from "./src/commands/attach-ticket-file";
import { createTicketCommand } from "./src/commands/create-ticket";
import { deleteTicketCommand } from "./src/commands/delete-ticket";
import { getTicketCommand } from "./src/commands/get-ticket";
import { queryTicketsCommand } from "./src/commands/query-tickets";
import { setTicketAttributeCommand } from "./src/commands/set-ticket-attribute";
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

const ticketActionParams = {
  ticket: params.text({ label: "Ticket", required: true }),
  agent: params.harness({ label: "Agent", required: true }),
};

const ticketTemplateVars = (ticket: string, template: string | undefined) => ({
  ticket,
  ...(template ? { templateName: template } : {}),
});

export default defineExtension({
  commands: {
    "run-attempt": {
      title: "Run attempt",
      menus: [{ slot: "ticket.headerPrimary", label: "Run attempt" }],
      params: {
        ...ticketActionParams,
        repo: params.repo({ label: "Repository", required: true }),
      },
      async run(ctx) {
        const { agent, repo, ticket } = ctx.params;

        await ctx.tickets.createAttempt({
          ticket,
          agent: agent.harnessId,
          model: agent.model,
          repoId: repo.repoId,
          branch: repo.branch,
          prompt: `Implement ticket: ${ticket}`,
        });
      },
    },
    "refine-ticket": {
      title: "Refine ticket",
      menus: [{ slot: "ticket.headerOverflow", label: "Refine ticket" }],
      params: {
        ...ticketActionParams,
        template: params.template({ label: "Template", type: "ticket", required: false }),
        context: params.longText({ label: "Additional context", required: false }),
      },
      async run(ctx) {
        const { agent, context, template, ticket } = ctx.params;

        await ctx.sessions.create({
          title: `Refine ticket: ${ticket}`,
          harness: agent,
          template: "refine-ticket",
          vars: {
            ...ticketTemplateVars(ticket, template),
            ...(context ? { additionalContext: context } : {}),
          },
        });
      },
    },
    "break-into-sub-tickets": {
      title: "Break into sub-tickets",
      menus: [{ slot: "ticket.headerOverflow", label: "Break into sub-tickets" }],
      params: {
        ...ticketActionParams,
        template: params.template({ label: "Template", type: "ticket", required: false }),
      },
      async run(ctx) {
        const { agent, template, ticket } = ctx.params;

        await ctx.sessions.create({
          title: `Break into sub-tickets: ${ticket}`,
          harness: agent,
          template: "create-sub-tickets",
          vars: ticketTemplateVars(ticket, template),
        });
      },
    },

    "query-tickets": queryTicketsCommand,
    "create-ticket": createTicketCommand,
    "attach-file": attachTicketFileCommand,
    "detach-file": detachTicketFileCommand,
    "get-ticket": getTicketCommand,
    "update-ticket": updateTicketCommand,
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
        entry: packageAsset("./src/settings-panel.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
    ticketTags: {
      title: "Ticket tags",
      target: "workbench.settings",
      scope: "project",
      webview: {
        entry: packageAsset("./src/tags-settings-panel.tsx", import.meta.url),
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
        displayProperties: ["status", "updated"],
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
        capabilities: ["commands.execute", "notification.show", "files.upload", "files.list", "files.delete"],
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
