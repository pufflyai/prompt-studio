import { commandRef, defineExtension, packageAsset, sessionEvents, worktreeEvents } from "@pstdio/sdk/extensions";
import { documentTemplates, sharedPromptTemplates } from "./extension-assets";
import { archiveTicketCommand } from "./src/commands/archive-ticket";
import { attachTicketFileCommand, detachTicketFileCommand } from "./src/commands/attach-ticket-file";
import { createTicketCommand } from "./src/commands/create-ticket";
import { deleteTicketCommand } from "./src/commands/delete-ticket";
import { getTicketCommand } from "./src/commands/get-ticket";
import { implementTicketCommand } from "./src/commands/implement-ticket";
import { listTicketFilesCommand } from "./src/commands/list-ticket-files";
import { listTicketsCommand } from "./src/commands/list-tickets";
import { pullTicketCommand } from "./src/commands/pull-ticket";
import { queryTicketResourcesCommand } from "./src/commands/query-ticket-resources";
import { queryTicketsCommand } from "./src/commands/query-tickets";
import { readTicketAttachmentCommand } from "./src/commands/read-ticket-attachment";
import { readTicketsCommand } from "./src/commands/read-tickets";
import { saveTicketCommand } from "./src/commands/save-ticket";
import { setTicketAttributeCommand } from "./src/commands/set-ticket-attribute";
import {
  breakIntoSubTicketsCommand,
  createWorkspaceCommand,
  refineTicketCommand,
  runAttemptCommand,
} from "./src/commands/ticket-actions";
import {
  createTicketFileCommand,
  deleteTicketFileCommand,
  listTicketFilesTreeCommand,
  renameTicketFileCommand,
  selectTicketFileCommand,
  updateTicketFileCommand,
} from "./src/commands/ticket-files";
import {
  createTicketStatusCommand,
  deleteTicketStatusCommand,
  readTicketStatusesCommand,
  reorderTicketStatusesCommand,
  setDefaultTicketStatusCommand,
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
import {
  ticketWorkspacesCommand,
  ticketWorktreesListCommand,
  ticketWorktreesRemoveAllCommand,
} from "./src/commands/ticket-workspaces";
import { updateTicketCommand } from "./src/commands/update-ticket";
import { updateWhenAttemptStatusCommand } from "./src/commands/update-when-attempt-status";
import { writeTicketCommand } from "./src/commands/write-ticket";
import { buildTicketAttributes } from "./src/data/mappers";
import { moveTicketToInProgress } from "./src/data/move-to-in-progress";
import { seedDefaultStatuses, seedDefaultTags } from "./src/data/seed";
import {
  setupWorkspaceAutomations,
  workspaceAutomationCommands,
  workspaceAutomationSettingsPanels,
} from "./src/workspace-automations";

export default defineExtension({
  commands: {
    "run-attempt": runAttemptCommand,
    "create-workspace": createWorkspaceCommand,
    "refine-ticket": refineTicketCommand,
    "break-into-sub-tickets": breakIntoSubTicketsCommand,

    "query-tickets": queryTicketsCommand,
    "read-tickets": readTicketsCommand,
    "list-tickets": listTicketsCommand,
    "query-ticket-resources": queryTicketResourcesCommand,
    "create-ticket": createTicketCommand,
    "attach-file": attachTicketFileCommand,
    "detach-file": detachTicketFileCommand,
    "get-ticket": getTicketCommand,
    "update-ticket": updateTicketCommand,
    "create-ticket-file": createTicketFileCommand,
    "update-ticket-file": updateTicketFileCommand,
    "rename-ticket-file": renameTicketFileCommand,
    "delete-ticket-file": deleteTicketFileCommand,
    "select-ticket-file": selectTicketFileCommand,
    "read-ticket-attachment": readTicketAttachmentCommand,
    "ticket-files.tree.body": listTicketFilesTreeCommand,
    "set-ticket-attribute": setTicketAttributeCommand,
    "archive-ticket": archiveTicketCommand,
    "delete-ticket": deleteTicketCommand,

    "write-ticket": writeTicketCommand,
    "save-ticket": saveTicketCommand,
    "pull-ticket": pullTicketCommand,
    "list-ticket-files": listTicketFilesCommand,
    "implement-ticket": implementTicketCommand,
    "update-when-attempt-status": updateWhenAttemptStatusCommand,
    "ticket-workspaces": ticketWorkspacesCommand,
    "ticket-worktrees-list": ticketWorktreesListCommand,
    "ticket-worktrees-remove-all": ticketWorktreesRemoveAllCommand,

    "ticketStatus.read": readTicketStatusesCommand,
    "ticketStatus.create": createTicketStatusCommand,
    "ticketStatus.update": updateTicketStatusCommand,
    "ticketStatus.delete": deleteTicketStatusCommand,
    "ticketStatus.setDefault": setDefaultTicketStatusCommand,
    "ticketStatus.reorder": reorderTicketStatusesCommand,

    "set-ticket-tags": setTicketTagsCommand,
    "ticketTag.read": readTicketTagsCommand,
    "ticketTag.create": createTicketTagCommand,
    "ticketTag.update": updateTicketTagCommand,
    "ticketTag.delete": deleteTicketTagCommand,
    "ticketTag.createOption": createTagOptionCommand,
    "ticketTag.updateOption": updateTagOptionCommand,
    "ticketTag.deleteOption": deleteTagOptionCommand,

    ...workspaceAutomationCommands,
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
    ...workspaceAutomationSettingsPanels,
  },

  hooks: {
    worktreeCreated: {
      event: worktreeEvents.created,
      async handler(ctx, payload) {
        await ctx.worktrees.bootstrap({
          repoPath: payload.repoPath,
          worktreePath: payload.worktreePath,
        });
      },
    },
    // When a session starts for a ticket-linked workspace, move that ticket into
    // the in-progress column. The lifecycle payload already carries the ticket
    // resolved from extension storage.
    sessionStarted: {
      event: sessionEvents.started,
      async handler(ctx, payload) {
        const ticketRef = payload.ticket?.id ?? payload.ticket?.shorthand;
        if (ticketRef) await moveTicketToInProgress(ctx.storage, ticketRef);
      },
    },
  },

  commandPaletteResources: {
    tickets: {
      title: "Tickets",
      resourceKind: "ticket",
      queryCommand: commandRef("pstdio-planner.query-ticket-resources"),
    },
  },
  dataRenderers: {
    tickets: {
      title: "Tickets",
      resourceKind: "ticket",
      attributes: buildTicketAttributes([]),
      queryCommand: commandRef("pstdio-planner.query-tickets"),
      updateAttributeCommand: commandRef("pstdio-planner.set-ticket-attribute"),
      createRow: {
        command: commandRef("pstdio-planner.create-ticket"),
        columnParam: "statusId",
        title: "New ticket",
        submitLabel: "Create",
      },
      rowActions: [
        {
          id: "create-workspace",
          label: "Create workspace",
          icon: "git-branch",
          command: commandRef("pstdio-planner.create-workspace"),
        },
        {
          id: "run-attempt",
          label: "Run attempt",
          icon: "play",
          command: commandRef("pstdio-planner.run-attempt"),
        },
        {
          id: "refine-ticket",
          label: "Refine ticket",
          icon: "sparkles",
          command: commandRef("pstdio-planner.refine-ticket"),
        },
        {
          id: "break-into-sub-tickets",
          label: "Break into sub-tickets",
          icon: "list-tree",
          command: commandRef("pstdio-planner.break-into-sub-tickets"),
        },
        { id: "archive", label: "Archive", icon: "archive", command: commandRef("pstdio-planner.archive-ticket") },
        {
          id: "delete",
          label: "Delete",
          icon: "trash",
          destructive: true,
          command: commandRef("pstdio-planner.delete-ticket"),
        },
      ],
      defaultSettings: {
        viewMode: "board",
        columnGrouping: "status",
        rowGrouping: "none",
        ordering: { attributeId: "manual", direction: "asc" },
        displayProperties: ["id", "type", "priority"],
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
      treeRenderer: "ticketFiles",
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
        // resource.open lets parent/dependency links open the target ticket as a tab.
        capabilities: ["commands.execute", "resource.open"],
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

  treeRenderers: {
    ticketFiles: {
      title: "Files",
      icon: "Files",
      bodyCommand: commandRef("pstdio-planner.ticket-files.tree.body"),
      defaultExpandedSectionIds: ["files"],
    },
  },

  async initialSetup(ctx) {
    await seedDefaultStatuses(ctx.storage);
    await seedDefaultTags(ctx.storage);
    await setupWorkspaceAutomations(ctx);
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
    document: {
      label: "Document",
      description: "Document templates",
    },
  },

  templates: {
    ...documentTemplates,
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
    ...sharedPromptTemplates,
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
