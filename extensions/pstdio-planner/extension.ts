import { commandRef, defineExtension, l10n, packageAsset, sessionEvents } from "@pstdio/sdk/extensions";
import { documentTemplates, sharedPromptTemplates } from "./extension-assets";
import { plannerCommands } from "./src/commands";
import { cleanupLegacyWorkspaceStatus } from "./src/data/cleanup-legacy-workspace-status";
import { buildTicketAttributes } from "./src/data/mappers";
import { findTicket } from "./src/data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "./src/data/seed";
import { ticketRefFromLifecyclePayload } from "./src/data/workspace-ticket-link";
import { worktreeCreatedHook } from "./src/hooks/worktree-created";
import { notifyBlocked } from "./src/planner-notifications";

export default defineExtension({
  settings: {
    properties: {
      "automation.maxInProgress": {
        type: "number",
        scope: "project",
        default: 2,
        title: "Maximum in-progress tickets",
        description: "Hard cap used by autonomous planner implementation automation.",
      },
    },
  },

  defaultLocale: "en",
  translations: {
    es: packageAsset("./l10n/es.json", import.meta.url),
    fr: packageAsset("./l10n/fr.json", import.meta.url),
    ja: packageAsset("./l10n/ja.json", import.meta.url),
    ko: packageAsset("./l10n/ko.json", import.meta.url),
    "zh-Hans": packageAsset("./l10n/zh-Hans.json", import.meta.url),
    "zh-Hant": packageAsset("./l10n/zh-Hant.json", import.meta.url),
  },

  commands: plannerCommands,

  settingsSections: {
    planner: {
      title: l10n("settingsSections.planner.title", "Planner"),
      scope: "project",
      order: 30,
    },
  },

  settingsPanels: {
    ticketStatuses: {
      title: l10n("settingsPanels.ticketStatuses.title", "Ticket status"),
      target: "workbench.settings",
      scope: "project",
      section: "planner",
      icon: "list-checks",
      webview: {
        entry: packageAsset("./src/views/settings-panel.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
    ticketTags: {
      title: l10n("settingsPanels.ticketTags.title", "Ticket tags"),
      target: "workbench.settings",
      scope: "project",
      section: "planner",
      icon: "tag",
      webview: {
        entry: packageAsset("./src/views/tags-settings-panel.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
  },

  // Automation-driven session behavior and recurring scheduling live in the
  // repo-local pstdio-planner-loops extension; the planner keeps only hooks that
  // maintain planner-owned data and notifications.
  hooks: {
    worktreeCreated: worktreeCreatedHook,
    sessionAwaitingInput: {
      event: sessionEvents.awaitingInput,
      async handler(ctx, payload) {
        const ticketRef = ticketRefFromLifecyclePayload(payload);
        const ticket = ticketRef ? await findTicket(ctx.storage, ticketRef) : null;
        if (ticket) await notifyBlocked(ctx, ticket, payload.sessionId);
      },
    },
  },

  commandPaletteResources: {
    tickets: {
      title: l10n("commandPaletteResources.tickets.title", "Tickets"),
      resourceKind: "ticket",
      queryCommand: commandRef("pstdio-planner.query-ticket-resources"),
    },
  },

  // Reusable properties renderer: serializable params rendered natively through the host
  // ParamEditor; status/tags edit live and references render as resource tags. A panel
  // (below) places it into the right panel for the open ticket.
  controlsRenderers: {
    ticketProperties: {
      title: l10n("controls.ticketProperties.title", "Properties"),
      queryCommand: commandRef("pstdio-planner.ticket-properties.query"),
      updateValueCommand: commandRef("pstdio-planner.ticket-properties.update"),
      emptyTitle: l10n("controls.ticketProperties.emptyTitle", "No ticket selected"),
    },
  },
  kanbanRenderers: {
    tickets: {
      title: l10n("kanbanRenderers.tickets.title", "Tickets"),
      resourceKind: "ticket",
      attributes: buildTicketAttributes([]),
      queryCommand: commandRef("pstdio-planner.query-tickets"),
      onRowActivate: (_ctx, { row }) =>
        row.resource ? { kind: "resource", resource: row.resource, input: { strategy: "replace-active" } } : undefined,
      updateAttributeCommand: commandRef("pstdio-planner.set-ticket-attribute"),
      reorderCommand: commandRef("pstdio-planner.reorder-ticket"),
      columnActionCommand: commandRef("pstdio-planner.ticket-column-action"),
      createRow: {
        command: commandRef("pstdio-planner.create-ticket"),
        columnParam: "statusId",
        title: l10n("kanbanRenderers.tickets.createRow.title", "New ticket"),
        submitLabel: l10n("kanbanRenderers.tickets.createRow.submitLabel", "Create ticket"),
        // Declared literally rather than via params.markdown()/params.files():
        // the builders ship in @pstdio/sdk > 0.15.0, and this extension resolves
        // the published SDK at runtime. Swap to the builders after that release.
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
          command: commandRef("pstdio-planner.attach-file"),
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
          command: commandRef("pstdio-planner.create-workspace"),
        },
        {
          id: "run-attempt",
          label: l10n("kanbanRenderers.tickets.rowActions.runAttempt", "Run attempt"),
          icon: "play",
          command: commandRef("pstdio-planner.run-attempt"),
        },
        {
          id: "refine-ticket",
          label: l10n("kanbanRenderers.tickets.rowActions.refineTicket", "Refine ticket"),
          icon: "sparkles",
          command: commandRef("pstdio-planner.refine-ticket"),
        },
        {
          id: "break-into-sub-tickets",
          label: l10n("kanbanRenderers.tickets.rowActions.breakIntoSubTickets", "Break into sub-tickets"),
          icon: "list-tree",
          command: commandRef("pstdio-planner.break-into-sub-tickets"),
        },
        {
          id: "archive",
          label: l10n("kanbanRenderers.tickets.rowActions.archive", "Archive"),
          icon: "archive",
          command: commandRef("pstdio-planner.archive-ticket"),
        },
        {
          id: "delete",
          label: l10n("kanbanRenderers.tickets.rowActions.delete", "Delete"),
          icon: "trash",
          destructive: true,
          command: commandRef("pstdio-planner.delete-ticket"),
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
  },

  modes: {
    ticket: {
      id: "pstdio-planner.ticket",
      label: l10n("modes.ticket.label", "Ticket"),
      icon: "FileText",
      resourceKind: "ticket",
      layout: {
        panels: ["main", "secondary", "side"],
        open: [{ region: "sidenav", panel: "ticketFiles", pinned: true }],
      },
    },
  },

  fileRenderers: {
    // Ticket editor, rendered natively by the host (no webview). Bound to the one
    // `ticket` resource; the files tree picks which document it shows.
    ticketContent: {
      title: l10n("fileRenderers.ticketContent.title", "Ticket"),
      resourceKind: "ticket",
      loadCommand: commandRef("pstdio-planner.get-ticket-content"),
      saveCommand: commandRef("pstdio-planner.save-ticket-content"),
    },
  },

  panels: {
    ticketEditor: {
      title: l10n("panels.ticketEditor.title", "Ticket"),
      region: "main",
      closable: false,
      resourceKind: "ticket",
      fileRenderer: "ticketContent",
      panelMenus: {
        properties: {
          title: l10n("panels.ticketProperties.title", "Properties"),
          side: "right",
          controlsRenderer: "ticketProperties",
        },
      },
    },
    // Files tree in the selected ticket's Sidenav resource section. Selecting a node
    // swaps the editor's document in place (it runs select-ticket-document).
    ticketFiles: {
      title: l10n("panels.ticketFiles.title", "Files"),
      region: "sidenav",
      closable: false,
      resourceKind: "ticket",
      treeRenderer: "ticketFiles",
    },
  },

  treeRenderers: {
    ticketFiles: {
      title: l10n("treeRenderers.ticketFiles.title", "Files"),
      icon: "Files",
      bodyCommand: commandRef("pstdio-planner.ticket-files.tree.body"),
      defaultExpandedSectionIds: ["files", "sub-tickets", "workspaces", "sessions"],
    },
  },

  async initialSetup(ctx) {
    await cleanupLegacyWorkspaceStatus(ctx.storage);
    await seedDefaultStatuses(ctx.storage);
    await seedDefaultTags(ctx.storage);
  },

  async migrate(ctx) {
    await cleanupLegacyWorkspaceStatus(ctx.storage);
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
