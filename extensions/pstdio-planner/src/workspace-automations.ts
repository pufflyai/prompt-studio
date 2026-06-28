import {
  defineCommand,
  type ExtensionSessionResource,
  type ExtensionWorkspace,
  l10n,
  packageAsset,
  params,
  type ResourceAnchor,
  type SettingsPanelContribution,
} from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./data/collections";
import { findTicket, resolveStatusId } from "./data/resolve";
import type { StoredTicket } from "./data/types";
import { ticketShorthandFromWorkspace } from "./data/workspace-ticket-link";
import {
  notifyReadyToMerge,
  notifyReviewReady,
  resolveReadyToMergeNotification,
  resolveReviewReadyNotification,
  ticketAnchor,
} from "./planner-notifications";
import {
  createWorkspaceStatusDefinition,
  deleteWorkspaceStatusDefinition,
  ensureDefaultWorkspaceStatuses,
  readWorkspaceStatusData,
  reorderWorkspaceStatusDefinitions,
  setDefaultWorkspaceStatusDefinition,
  setWorkspaceStatusValue,
  updateWorkspaceStatusDefinition,
} from "./workspace-statuses/workspace-status";
import { workspaceIdForStatusFrom } from "./workspace-statuses/workspace-status-helpers";

const stringMetadata = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const workspaceIdFrom = (ctx: {
  params: { workspaceId?: string };
  resource?: { type: string; id: string; metadata?: Record<string, unknown> };
}) => {
  const workspaceId = ctx.params.workspaceId?.trim();
  if (workspaceId) return workspaceId;
  if (ctx.resource?.type !== "workspace") throw new Error("Workspace is required.");
  return stringMetadata(ctx.resource.metadata, "workspaceId") ?? ctx.resource.id;
};

const ticketRefFrom = (ctx: {
  params: { ticket?: string };
  resource?: { type: string; label?: string; metadata?: Record<string, unknown> };
}) => {
  return ctx.params.ticket?.trim() ?? stringMetadata(ctx.resource?.metadata, "ticket") ?? ctx.resource?.label?.trim();
};

const resolveTicketForWorkspace = async (
  ctx: { storage: Parameters<typeof findTicket>[0] },
  workspace: ExtensionWorkspace,
) => {
  const shorthand = ticketShorthandFromWorkspace(workspace);
  return shorthand ? findTicket(ctx.storage, shorthand) : undefined;
};

const isUnknownStatusError = (error: unknown) => error instanceof Error && error.message.startsWith("Unknown status ");

const resolveReviewStatusId = async (storage: Parameters<typeof resolveStatusId>[0]) => {
  for (const status of ["In Review", "review"]) {
    try {
      return await resolveStatusId(storage, status);
    } catch (error) {
      if (!isUnknownStatusError(error)) throw error;
      // Try the next conventional review status name.
    }
  }
  return null;
};

const summarizeLinkedWorkspaces = async (
  ctx: {
    storage: Parameters<typeof readWorkspaceStatusData>[0]["storage"];
    workspaces: { list(): Promise<ExtensionWorkspace[]> };
  },
  ticket: StoredTicket,
) => {
  const workspaces = (await ctx.workspaces.list()).filter(
    (workspace) => ticketShorthandFromWorkspace(workspace) === ticket.shorthand,
  );
  if (workspaces.length === 0) return { count: 0, allReviewed: false, readyToMerge: false };

  const data = await readWorkspaceStatusData({
    storage: ctx.storage,
    workspaceIds: workspaces.map((workspace) => workspace.id),
  });
  const statuses = workspaces.map((workspace) => data.valuesByWorkspaceId[workspace.id]?.status);
  const allReviewed = statuses.every((status) => status === "reviewed");
  // A workspace is "settled" once it is reviewed or merged. The ticket stays
  // ready-to-merge while every linked workspace is settled AND at least one
  // is still reviewed (i.e. has merge work pending). All-merged means there's
  // nothing left to ship, so the inbox item drops.
  const allSettled = statuses.every((status) => status === "reviewed" || status === "merged");
  const hasReviewed = statuses.some((status) => status === "reviewed");
  return { count: workspaces.length, allReviewed, readyToMerge: allSettled && hasReviewed };
};

const moveTicketToReviewWhenAllWorkspacesReviewed = async (
  ctx: {
    storage: Parameters<typeof readWorkspaceStatusData>[0]["storage"];
    workspaces: { list(): Promise<ExtensionWorkspace[]> };
  },
  ticket: StoredTicket,
) => {
  const summary = await summarizeLinkedWorkspaces(ctx, ticket);
  if (!summary.allReviewed) return { readyToMerge: false, updated: false };

  const statusId = await resolveReviewStatusId(ctx.storage);
  if (!statusId) return { readyToMerge: false, updated: false };
  if (ticket.statusId === statusId) return { readyToMerge: true, updated: false, statusId };

  await ticketsCollection(ctx.storage).put(ticket.id, {
    ...ticket,
    statusId,
    updatedAt: new Date().toISOString(),
  });
  return { readyToMerge: true, updated: true, statusId };
};

// Ready-to-merge tracks a derived state across every linked workspace, so it
// can become stale when one regresses out of `reviewed` (review surfaces more
// work) AND it must keep showing when one is merged while a sibling is still
// reviewed. Re-evaluate on every status change and notify/resolve accordingly.
const syncReadyToMergeNotification = async (ctx: Parameters<typeof runStatusAutomation>[0], ticket: StoredTicket) => {
  const { readyToMerge } = await summarizeLinkedWorkspaces(ctx, ticket);
  if (readyToMerge) {
    await notifyReadyToMerge(ctx, ticket);
  } else {
    await resolveReadyToMergeNotification(ctx, ticket);
  }
};

const runStatusAutomation = async (
  ctx: {
    extensionId: string;
    projectId: string;
    params: { sessionId?: string };
    sessions: {
      create(input: {
        title: string;
        template: string;
        vars: Record<string, string>;
        workspaceId: string;
        anchors: ResourceAnchor[];
        originalSessionId?: string;
      }): Promise<ExtensionSessionResource>;
      followup(input: { sessionId: string; template: string; vars: Record<string, string> }): Promise<void>;
      get(id: string): Promise<{ original_session_id?: string | null } | null>;
    };
    storage: Parameters<typeof findTicket>[0];
    notify: {
      action(input: Record<string, unknown>): Promise<unknown>;
      resolve(input: { dedupeKey: string; status: "done" }): Promise<unknown>;
    };
    workspaces: { get(id: string): Promise<ExtensionWorkspace | null>; list(): Promise<ExtensionWorkspace[]> };
  },
  workspaceId: string,
  status: string,
) => {
  const workspace = await ctx.workspaces.get(workspaceId);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

  const ticket = await resolveTicketForWorkspace(ctx, workspace);
  if (!ticket) return { automated: false };

  // The workspace status row has already been persisted by the caller before
  // this runs, so re-evaluate ready-to-merge here, before any branch that can
  // throw (session creation, downstream notifications). A failure after this
  // point can no longer leave a stale ready-to-merge inbox item visible.
  await syncReadyToMergeNotification(ctx, ticket);

  const anchor = ticketAnchor(ctx, ticket);
  if (status === "review-ready") {
    const session = await ctx.sessions.create({
      workspaceId: workspace.id,
      title: `Code review: ${ticket.shorthand}`,
      template: "review-code",
      vars: { ticket: ticket.shorthand },
      anchors: [anchor],
      originalSessionId: ctx.params.sessionId,
    });
    await notifyReviewReady(ctx, workspace, ticket, session.id);
    return { automated: true, reviewSessionId: session.id };
  }

  if (status === "changes-requested") {
    const sessionId = ctx.params.sessionId;
    const currentSession = sessionId ? await ctx.sessions.get(sessionId) : null;
    const originalSessionId = currentSession?.original_session_id ?? undefined;
    if (originalSessionId) {
      await ctx.sessions.followup({
        sessionId: originalSessionId,
        template: "fix-changes-requested",
        vars: { ticket: ticket.shorthand },
      });
      return { automated: true, followedUpSessionId: originalSessionId };
    }

    const session = await ctx.sessions.create({
      workspaceId: workspace.id,
      title: `Fix changes requested: ${ticket.shorthand}`,
      template: "fix-changes-requested",
      vars: { ticket: ticket.shorthand },
      anchors: [anchor],
      originalSessionId: sessionId,
    });
    return { automated: true, fixSessionId: session.id };
  }

  if (status === "reviewed") {
    const result = await moveTicketToReviewWhenAllWorkspacesReviewed(ctx, ticket);
    await resolveReviewReadyNotification(ctx, workspace.id);
    return result;
  }

  if (status === "merged") {
    return { automated: true };
  }

  return { automated: false };
};

const runStatusAutomationSafely = async (
  ctx: Parameters<typeof runStatusAutomation>[0],
  workspaceId: string,
  status: string,
) => {
  try {
    return await runStatusAutomation(ctx, workspaceId, status);
  } catch (error) {
    return {
      automated: false,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
};

export const setupWorkspaceAutomations = (ctx: { storage: Parameters<typeof ensureDefaultWorkspaceStatuses>[0] }) =>
  ensureDefaultWorkspaceStatuses(ctx.storage);

export const workspaceAutomationSettingsPanels = {
  workspaceStatuses: {
    title: l10n("settingsPanels.workspaceStatuses.title", "Workspace statuses"),
    target: "workbench.settings",
    scope: "project",
    webview: {
      entry: packageAsset("./workspace-statuses/settings-panel.tsx", import.meta.url),
      capabilities: ["commands.execute"],
    },
  },
} satisfies Record<string, SettingsPanelContribution>;

export const workspaceAutomationCommands = {
  "workspaceStatus.read": defineCommand({
    title: l10n("commands.workspaceStatus.read.title", "Read workspace statuses"),
    params: {
      workspaceIds: params.json<string[]>(),
    },
    async run(ctx) {
      return readWorkspaceStatusData({
        storage: ctx.storage,
        workspaceIds: ctx.params.workspaceIds,
      });
    },
  }),
  "workspaceStatus.set": defineCommand({
    title: l10n("commands.workspaceStatus.set.title", "Set workspace status"),
    cli: {
      globalAliases: [["workspaces", "set-status"]],
      examples: ["pstdio workspaces set-status --workspace PS-1_A1 --status review-ready"],
    },
    params: {
      workspace: params.text({ label: "Workspace", required: false }),
      workspaceId: params.text({ label: "Workspace ID", required: false }),
      status: params.text({ label: "Status", required: true }),
      sessionId: params.text({ label: "Session", required: false }),
    },
    async run(ctx) {
      const workspaceId = await workspaceIdForStatusFrom(ctx);
      const before = await readWorkspaceStatusData({ storage: ctx.storage, workspaceIds: [workspaceId] });
      const previousStatus = before.valuesByWorkspaceId[workspaceId]?.status;
      const value = await setWorkspaceStatusValue({
        storage: ctx.storage,
        status: ctx.params.status,
        workspaceId,
      });
      // Re-setting the same status must not re-fire the automation (e.g. spawn a
      // second review/fix session); only a real transition runs it.
      const automation =
        previousStatus === ctx.params.status
          ? { automated: false }
          : await runStatusAutomationSafely(ctx, workspaceId, ctx.params.status);
      return { ...value, automation };
    },
  }),
  "workspaceStatus.create": defineCommand({
    title: l10n("commands.workspaceStatus.create.title", "Create workspace status"),
    params: {
      label: params.text({ label: "Label", required: true }),
      color: params.text({ label: "Color", required: false }),
      icon: params.text({ label: "Icon", required: false }),
    },
    async run(ctx) {
      return createWorkspaceStatusDefinition({
        color: ctx.params.color,
        icon: ctx.params.icon ?? null,
        label: ctx.params.label,
        storage: ctx.storage,
      });
    },
  }),
  "workspaceStatus.update": defineCommand({
    title: l10n("commands.workspaceStatus.update.title", "Update workspace status"),
    params: {
      statusId: params.text({ label: "Status", required: true }),
      label: params.text({ label: "Label", required: false }),
      color: params.text({ label: "Color", required: false }),
      icon: params.text({ label: "Icon", required: false }),
      sortOrder: params.number({ label: "Sort order", required: false }),
    },
    async run(ctx) {
      return updateWorkspaceStatusDefinition({
        color: ctx.params.color,
        icon: ctx.params.icon ?? null,
        label: ctx.params.label,
        sortOrder: ctx.params.sortOrder,
        statusId: ctx.params.statusId,
        storage: ctx.storage,
      });
    },
  }),
  "workspaceStatus.setDefault": defineCommand({
    title: l10n("commands.workspaceStatus.setDefault.title", "Set default workspace status"),
    params: {
      statusId: params.text({ label: "Status", required: true }),
    },
    async run(ctx) {
      return setDefaultWorkspaceStatusDefinition({
        statusId: ctx.params.statusId,
        storage: ctx.storage,
      });
    },
  }),
  "workspaceStatus.delete": defineCommand({
    title: l10n("commands.workspaceStatus.delete.title", "Delete workspace status"),
    params: {
      statusId: params.text({ label: "Status", required: true }),
    },
    async run(ctx) {
      return deleteWorkspaceStatusDefinition({
        statusId: ctx.params.statusId,
        storage: ctx.storage,
      });
    },
  }),
  "workspaceStatus.reorder": defineCommand({
    title: l10n("commands.workspaceStatus.reorder.title", "Reorder workspace statuses"),
    params: {
      statusIds: params.json<string[]>(),
    },
    async run(ctx) {
      return reorderWorkspaceStatusDefinitions({
        statusIds: ctx.params.statusIds ?? [],
        storage: ctx.storage,
      });
    },
  }),
  runReview: defineCommand({
    title: l10n("commands.runReview.title", "Run review"),
    cli: true,
    menus: [
      {
        target: "workbench.nav.overflow",
        label: l10n("commands.runReview.menuLabel", "Run review"),
        icon: "clipboard-check",
        when: { resourceType: ["workspace"] },
      },
    ],
    params: {
      workspaceId: params.text({ label: "Workspace", required: false }),
      ticket: params.text({ label: "Ticket", required: false }),
      harness: params.harness({ label: "Harness", required: false }),
    },
    async run(ctx) {
      const { harness } = ctx.params;
      const workspaceId = workspaceIdFrom(ctx);
      const ticket = ticketRefFrom(ctx);
      await ctx.sessions.create({
        workspaceId,
        title: `Code review: ${ticket || "ticket"}`,
        harness,
        template: "review-code",
        vars: ticket ? { ticket } : {},
      });
    },
  }),
};
