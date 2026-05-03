import { defineExtension, defineSlot, packageAsset, params, projectSlots } from "@pstdio/sdk/extensions";

// Slot declarations for the ticket UI surfaces that exist in the dashboard today
// (see packages/pstdio-dashboard/src/features/ticket-list and .../ticket).
// Other extensions reach for these via `ticketSlots.*` to contribute commands.
const ticketSlots = {
  headerPrimary: defineSlot<{ projectId: string }, "menu">("ticket.headerPrimary", {
    kind: "menu",
    label: "Tickets header — primary",
    description: "Primary action group on the tickets list/board header.",
  }),
  headerOverflow: defineSlot<{ projectId: string }, "menu">("ticket.headerOverflow", {
    kind: "menu",
    label: "Tickets header — overflow",
    description: "Overflow menu on the tickets list/board header.",
  }),
  rowActions: defineSlot<{ projectId: string; ticketId: string }, "menu">("ticket.rowActions", {
    kind: "menu",
    label: "Ticket row actions",
    description: "Per-card context menu on tickets list/board.",
  }),
  detailHeaderPrimary: defineSlot<{ projectId: string; ticketId: string }, "menu">("ticket.detailHeaderPrimary", {
    kind: "menu",
    label: "Ticket detail — primary",
    description: "Primary action group on the ticket detail page header.",
  }),
  detailHeaderOverflow: defineSlot<{ projectId: string; ticketId: string }, "menu">("ticket.detailHeaderOverflow", {
    kind: "menu",
    label: "Ticket detail — overflow",
    description: "Overflow menu on the ticket detail page header.",
  }),
};

export default defineExtension({
  id: "pstdio.core-tickets",
  namespace: "core-tickets",
  name: "Core Tickets",
  version: "0.1.0",
  description: "Ticket-targeted slots, ticket-list/detail webviews, and ticket actions migrated from plugins.",

  slots: ticketSlots,

  routes: {
    ticketsList: {
      path: "tickets",
      label: "Tickets",
      webview: { entry: packageAsset("./dist/tickets-list-page.html", import.meta.url) },
    },
    ticketDetail: {
      path: "tickets/:ticketId",
      label: "Ticket",
      webview: { entry: packageAsset("./dist/ticket-page.html", import.meta.url) },
    },
  },

  navigation: {
    ticketsList: {
      slot: projectSlots.sidebarNav,
      label: "Tickets",
      icon: "list-todo",
      route: "tickets",
    },
  },

  commands: {
    // ────────────────────────────────────────────────────────────
    // Legacy: { key: "run-attempt", targetType: "ticket", placement: "primary" }
    // ────────────────────────────────────────────────────────────
    "run-attempt": {
      title: "Run attempt",
      description: "Create a new attempt and start a session so implementation can begin in one click.",
      menus: [
        { slot: ticketSlots.headerPrimary, label: "Run attempt" },
        { slot: ticketSlots.detailHeaderPrimary, label: "Run attempt" },
      ],
      params: {
        agent: params.harness({ label: "Agent" }),
        repo: params.repo({ label: "Repository" }),
      },
      async run(ctx) {
        const ticketShorthand = ctx.resource?.id;
        if (!ticketShorthand) return;

        // TODO(helper): no `createAttempt` is exposed on the extension `ctx` yet.
        // Once it is, replace this body with the attempt-creation call below
        // (the `ctx.sessions.create` call here is a temporary stand-in so the
        // command isn't a no-op while the helper is missing).
        //
        // Original plugin body:
        //   await createAttempt(ctx, {
        //     ticketId: ctx.target.shorthand,
        //     agent: agent?.agent,
        //     model: agent?.model,
        //     repo_id: repo?.repo,
        //     branch: repo?.branch,
        //     prompt: `Implement ticket: ${ctx.target.shorthand}`,
        //   });

        const harness = ctx.params.agent;
        const repo = ctx.params.repo;
        await ctx.sessions.create({
          title: `Implement ticket: ${ticketShorthand}`,
          prompt: `Implement ticket: ${ticketShorthand}`,
          harness,
          repoId: repo?.repoId,
        });
      },
    },

    // ────────────────────────────────────────────────────────────
    // Legacy: { key: "refine-ticket", targetType: "ticket", placement: "overflow" }
    // ────────────────────────────────────────────────────────────
    "refine-ticket": {
      title: "Refine ticket",
      description: "Open a refinement session for the selected ticket.",
      menus: [
        { slot: ticketSlots.headerOverflow, label: "Refine ticket" },
        { slot: ticketSlots.detailHeaderOverflow, label: "Refine ticket" },
      ],
      params: {
        agent: params.harness({ label: "Agent" }),
        template: params.template({ type: "ticket", label: "Template", required: false }),
        context: params.longText({ label: "Additional context", required: false }),
      },
      async run(ctx) {
        const ticketShorthand = ctx.resource?.id;
        if (!ticketShorthand) return;

        const harness = ctx.params.agent;
        const template = ctx.params.template;
        const context = ctx.params.context;

        const parts = [`Refine ticket: ${ticketShorthand}`];
        if (template) parts.push(`Use template: ${template}`);
        if (context) parts.push(`Additional context:\n${context}`);

        await ctx.sessions.create({
          title: `Refine ticket: ${ticketShorthand}`,
          prompt: parts.join("\n\n"),
          harness,
        });
      },
    },

    // ────────────────────────────────────────────────────────────
    // Legacy: { key: "break-into-sub-tickets", targetType: "ticket", placement: "overflow" }
    // ────────────────────────────────────────────────────────────
    "break-into-sub-tickets": {
      title: "Break into sub-tickets",
      description: "Break the selected ticket into smaller, implementation-ready sub-tickets.",
      menus: [
        { slot: ticketSlots.headerOverflow, label: "Break into sub-tickets" },
        { slot: ticketSlots.detailHeaderOverflow, label: "Break into sub-tickets" },
      ],
      params: {
        agent: params.harness({ label: "Agent" }),
        template: params.template({ type: "ticket", label: "Template", required: false }),
      },
      async run(ctx) {
        const ticketShorthand = ctx.resource?.id;
        if (!ticketShorthand) return;

        const harness = ctx.params.agent;
        const template = ctx.params.template;

        const parts = [`Breakdown ticket: ${ticketShorthand} into sub-tickets`];
        if (template) parts.push(`Use template: ${template}`);

        await ctx.sessions.create({
          title: `Break into sub-tickets: ${ticketShorthand}`,
          prompt: parts.join("\n\n"),
          harness,
        });
      },
    },
  },
});
