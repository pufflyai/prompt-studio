import {
  attemptStatusEvents,
  defineExtension,
  packageAsset,
  params,
  sessionEvents,
  ticketEvents,
  workspaceCommands,
} from "@pstdio/sdk/extensions";
import { ticketCliCommands } from "./src/ticket-cli";
import { ticketBoardCommands, ticketDocumentCommands, ticketStatusCommands } from "./src/ticket-commands";
import { ensureDefaultTicketAutomationSetup } from "./src/ticket-status";

const stringMetadata = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const ticketRefFrom = (ctx: {
  params: { ticket?: string };
  resource?: { type: string; id: string; label?: string; metadata?: Record<string, unknown> };
}) => {
  const ticket = ctx.params.ticket?.trim();
  if (ticket) return ticket;
  if (ctx.resource?.type !== "ticket") throw new Error("Ticket is required.");
  return stringMetadata(ctx.resource.metadata, "shorthand") ?? ctx.resource.label ?? ctx.resource.id;
};

export default defineExtension({
  async initialSetup(ctx) {
    await ensureDefaultTicketAutomationSetup(ctx);
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
  },

  routes: {
    tickets: {
      path: "tickets",
      label: "Tickets",
      webview: {
        entry: packageAsset("./src/ticket-panel.tsx", import.meta.url),
        capabilities: ["commands.execute", "notification.show"],
      },
    },
  },

  treeItems: {
    tickets: {
      target: "workbench.left.tree",
      label: "Tickets",
      icon: "Ticket",
      action: { kind: "route", route: "tickets" },
      when: { mode: "project" },
    },
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

  commands: {
    ...ticketCliCommands,
    ...ticketBoardCommands,
    ...ticketDocumentCommands,
    ...ticketStatusCommands,
    runAttempt: {
      title: "Run attempt",
      description: "Start an implementation session for a ticket.",
      cli: true,
      menus: [
        {
          target: "workbench.top.actions",
          label: "Run attempt",
          icon: "play",
          presentation: "button",
          when: { resourceType: ["ticket"] },
        },
      ],
      params: {
        ticket: params.text({ label: "Ticket", required: true }),
        harness: params.harness({ label: "Harness", required: false }),
        repo: params.repo({ label: "Repository", required: false }),
      },
      async run(ctx) {
        const { harness, repo } = ctx.params;
        const ticket = ticketRefFrom(ctx);

        await ctx.tickets.createAttempt({
          ticket,
          agent: harness?.harnessId,
          model: harness?.model,
          repoId: repo?.repoId,
          branch: repo?.branch,
          prompt: `Implement ticket: ${ticket}`,
        });
      },
    },
    refineTicket: {
      title: "Refine ticket",
      description: "Start a ticket refinement session.",
      cli: true,
      menus: [{ target: "workbench.top.overflow", label: "Refine ticket", when: { resourceType: ["ticket"] } }],
      params: {
        ticket: params.text({ label: "Ticket", required: true }),
        harness: params.harness({ label: "Harness", required: false }),
        template: params.template({ label: "Template", type: "ticket", required: false }),
        context: params.longText({ label: "Additional context", required: false }),
      },
      async run(ctx) {
        const { context, harness, template } = ctx.params;
        const ticket = ticketRefFrom(ctx);
        const parts = [`Refine ticket: ${ticket}`];
        if (template) parts.push(`Use template: ${template}`);
        if (context) parts.push(`Additional context:\n${context}`);

        await ctx.sessions.create({
          title: `Refine ticket: ${ticket}`,
          harness,
          prompt: parts.join("\n\n"),
        });
      },
    },
    breakIntoSubTickets: {
      title: "Break into sub-tickets",
      description: "Start a ticket breakdown session.",
      cli: true,
      menus: [
        {
          target: "workbench.top.overflow",
          label: "Break into sub-tickets",
          when: { resourceType: ["ticket"] },
        },
      ],
      params: {
        ticket: params.text({ label: "Ticket", required: true }),
        harness: params.harness({ label: "Harness", required: false }),
        template: params.template({ label: "Template", type: "ticket", required: false }),
      },
      async run(ctx) {
        const { harness, template } = ctx.params;
        const ticket = ticketRefFrom(ctx);
        const parts = [`Breakdown ticket: ${ticket} into sub-tickets`];
        if (template) parts.push(`Use template: ${template}`);

        await ctx.sessions.create({
          title: `Break into sub-tickets: ${ticket}`,
          harness,
          prompt: parts.join("\n\n"),
        });
      },
    },
  },

  middlewares: {
    reviewReadyValidation: {
      command: workspaceCommands.setAttemptStatus,
      async handler(ctx) {
        if (ctx.params.status !== "review-ready") return ctx.commands.continue();

        const workspace = await ctx.workspaces.get(ctx.params.workspaceId);
        if (!workspace?.worktree_path) return ctx.commands.continue();

        const validation = await ctx.process.run({
          command: ["echo", "Replace with your validation command"],
          cwd: workspace.worktree_path,
        });

        if (validation.exitCode === 0) return ctx.commands.continue();

        const output = [validation.stdout, validation.stderr].join("\n").trim();
        return ctx.commands.reject({
          reason: output
            ? `Validation failed; cannot move to review-ready\n\n${output}`
            : "Validation failed; cannot move to review-ready",
        });
      },
    },
  },

  hooks: {
    ticketArchived: {
      event: ticketEvents.archived,
      async handler(ctx, payload) {
        await ctx.worktrees.removeAllForTicket({ ticketId: payload.ticket.id });
      },
    },
    sessionStarted: {
      event: sessionEvents.started,
      async handler(ctx, payload) {
        const ticket = payload.ticket;
        if (!ticket) return;

        if (ticket.status_name !== "review") await ctx.tickets.setStatus({ ticket: ticket.shorthand, status: "wip" });

        if (payload.workspace && !payload.workspace.attempt_status_name) {
          await ctx.workspaces.setAttemptStatus({
            workspaceId: payload.workspace.id,
            status: "wip",
            sessionId: payload.sessionId,
          });
        }
      },
    },
    attemptStatusChanged: {
      event: attemptStatusEvents.changed,
      async handler(ctx, payload) {
        const ticket = payload.ticket;
        if (!ticket) return;

        const ref = ticket.shorthand;

        if (payload.toStatus === "blocked") await ctx.tickets.setStatus({ ticket: ref, status: "blocked" });
        if (payload.toStatus === "reviewed") {
          await ctx.tickets.updateWhenAllAttemptsMatch({
            ticket: ref,
            allAttemptsStatus: "reviewed",
            setStatus: "review",
          });
        }

        const workspaceId = payload.workspace.id;
        if (payload.toStatus === "review-ready") {
          if (payload.worktreePath) {
            await ctx.process.runOrThrow({
              command: ["pstdio", "tickets", "save", "--id", ref],
              cwd: payload.worktreePath,
            });
          }

          await ctx.sessions.create({
            workspaceId,
            title: `Code review: ${ref}`,
            template: "review-code",
            vars: { ticket: ref },
            originalSessionId: payload.sessionId ?? undefined,
          });
        }

        if (payload.toStatus === "changes-requested") {
          const input = { template: "fix-changes-requested", vars: { ticket: ref } };
          if (payload.originalSessionId) {
            await ctx.sessions.followup({ sessionId: payload.originalSessionId, ...input });
            return;
          }

          await ctx.sessions.create({
            workspaceId,
            title: `Fix changes requested: ${ref}`,
            originalSessionId: payload.sessionId ?? undefined,
            ...input,
          });
        }
      },
    },
  },
});
