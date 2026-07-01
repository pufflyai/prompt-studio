import { commandRef, defineExtension, gitEvents, l10n, packageAsset, sessionEvents } from "@pstdio/sdk/extensions";
import { documentTemplates, sharedPromptTemplates } from "./extension-assets";
import { plannerCommands } from "./src/commands";
import { buildTicketAttributes } from "./src/data/mappers";
import { moveTicketToInProgress } from "./src/data/move-to-in-progress";
import { findTicket } from "./src/data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "./src/data/seed";
import { ticketRefFromLifecyclePayload } from "./src/data/workspace-ticket-link";
import { worktreeCreatedHook } from "./src/hooks/worktree-created";
import { notifyBlocked, resolveReadyToMergeNotification } from "./src/planner-notifications";
import { setupWorkspaceAutomations, workspaceAutomationSettingsPanels } from "./src/workspace-automations";

export default defineExtension({
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

  settingsPanels: {
    ticketStatuses: {
      title: l10n("settingsPanels.ticketStatuses.title", "Ticket statuses"),
      target: "workbench.settings",
      scope: "project",
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
      icon: "tag",
      webview: {
        entry: packageAsset("./src/views/tags-settings-panel.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
    ...workspaceAutomationSettingsPanels,
  },

  hooks: {
    worktreeCreated: worktreeCreatedHook,
    // When a session starts for a ticket-linked workspace, move that ticket into
    // the in-progress column. The ticket is derived from the workspace's generic
    // resource anchors, which the planner owns.
    sessionStarted: {
      event: sessionEvents.started,
      async handler(ctx, payload) {
        const ticketRef = ticketRefFromLifecyclePayload(payload);
        if (ticketRef) await moveTicketToInProgress(ctx.storage, ticketRef);
      },
    },
    sessionAwaitingInput: {
      event: sessionEvents.awaitingInput,
      async handler(ctx, payload) {
        const ticketRef = ticketRefFromLifecyclePayload(payload);
        const ticket = ticketRef ? await findTicket(ctx.storage, ticketRef) : null;
        if (ticket) await notifyBlocked(ctx, ticket, payload.sessionId);
      },
    },
    gitMerged: {
      event: gitEvents.merged,
      async handler(ctx, payload) {
        const ticketRef = ticketRefFromLifecyclePayload(payload);
        const ticket = ticketRef ? await findTicket(ctx.storage, ticketRef) : null;
        if (ticket) await resolveReadyToMergeNotification(ctx, ticket);
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
  // ParamEditor; status/tags edit live and references render as resource tags. A view
  // (below) places it into the right panel for the open ticket.
  controlsRenderers: {
    ticketProperties: {
      title: l10n("controls.ticketProperties.title", "Properties"),
      queryCommand: commandRef("pstdio-planner.ticket-properties.query"),
      updateValueCommand: commandRef("pstdio-planner.ticket-properties.update"),
      emptyTitle: l10n("controls.ticketProperties.emptyTitle", "No ticket selected"),
    },
  },
  dataRenderers: {
    tickets: {
      title: l10n("dataRenderers.tickets.title", "Tickets"),
      resourceKind: "ticket",
      attributes: buildTicketAttributes([]),
      queryCommand: commandRef("pstdio-planner.query-tickets"),
      updateAttributeCommand: commandRef("pstdio-planner.set-ticket-attribute"),
      reorderCommand: commandRef("pstdio-planner.reorder-ticket"),
      columnActionCommand: commandRef("pstdio-planner.ticket-column-action"),
      createRow: {
        command: commandRef("pstdio-planner.create-ticket"),
        columnParam: "statusId",
        title: l10n("dataRenderers.tickets.createRow.title", "New ticket"),
        submitLabel: l10n("dataRenderers.tickets.createRow.submitLabel", "Create"),
      },
      rowActions: [
        {
          id: "create-workspace",
          label: l10n("dataRenderers.tickets.rowActions.createWorkspace", "Create workspace"),
          icon: "git-branch",
          command: commandRef("pstdio-planner.create-workspace"),
        },
        {
          id: "run-attempt",
          label: l10n("dataRenderers.tickets.rowActions.runAttempt", "Run attempt"),
          icon: "play",
          command: commandRef("pstdio-planner.run-attempt"),
        },
        {
          id: "refine-ticket",
          label: l10n("dataRenderers.tickets.rowActions.refineTicket", "Refine ticket"),
          icon: "sparkles",
          command: commandRef("pstdio-planner.refine-ticket"),
        },
        {
          id: "break-into-sub-tickets",
          label: l10n("dataRenderers.tickets.rowActions.breakIntoSubTickets", "Break into sub-tickets"),
          icon: "list-tree",
          command: commandRef("pstdio-planner.break-into-sub-tickets"),
        },
        {
          id: "archive",
          label: l10n("dataRenderers.tickets.rowActions.archive", "Archive"),
          icon: "archive",
          command: commandRef("pstdio-planner.archive-ticket"),
        },
        {
          id: "delete",
          label: l10n("dataRenderers.tickets.rowActions.delete", "Delete"),
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
      emptyTitle: l10n("dataRenderers.tickets.emptyTitle", "No tickets yet"),
      emptyDescription: l10n(
        "dataRenderers.tickets.emptyDescription",
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
        reset: true,
        open: [{ target: "workbench.left", view: "ticketFiles", pinned: true }],
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

  views: {
    ticketEditor: {
      title: l10n("views.ticketEditor.title", "Ticket"),
      resourceKind: "ticket",
      fileRenderer: "ticketContent",
    },
    // Files tree beside the editor. Selecting a node swaps the editor's document
    // in place (it runs select-ticket-document); the tree never tears down.
    ticketFiles: {
      title: l10n("views.ticketFiles.title", "Files"),
      resourceKind: "ticket",
      surface: "panel",
      treeRenderer: "ticketFiles",
      hostTreeHeader: "default",
    },
    // Properties panel, pinned in the right panel for the open ticket, backed by the
    // ticketProperties controls renderer.
    ticketProperties: {
      title: l10n("views.ticketProperties.title", "Properties"),
      resourceKind: "ticket",
      surface: "panel",
      target: "workbench.main.right",
      controlsRenderer: "ticketProperties",
    },
    createTicketModal: {
      title: l10n("views.createTicketModal.title", "New ticket"),
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
      title: l10n("treeRenderers.ticketFiles.title", "Files"),
      icon: "Files",
      bodyCommand: commandRef("pstdio-planner.ticket-files.tree.body"),
      defaultExpandedSectionIds: ["files", "sub-tickets", "workspaces", "sessions"],
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
