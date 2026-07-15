import type {
  ExtensionActivityApi,
  ExtensionSettingsApi,
  ExtensionStorageApi,
  JsonObject,
} from "@pstdio/sdk/extensions";
import { executePlanner, type PlannerContext, planner } from "./planner-client";

export interface AutomationContext extends PlannerContext {
  storage: ExtensionStorageApi;
  settings: ExtensionSettingsApi;
  activity: ExtensionActivityApi;
  sessions: { get(id: string): Promise<{ id: string; status?: string } | null> };
}

export const automationEnabled = async (ctx: AutomationContext) =>
  (await ctx.settings.get("automation.enabled")) === true;

export const maxInProgress = async (ctx: AutomationContext) =>
  (await executePlanner(ctx, planner.automationPolicy, {})).maxInProgress;

export const recordAutomationActivity = (
  ctx: AutomationContext,
  automation: string,
  message: string,
  metadata: JsonObject = {},
) => ctx.activity.record({ message: `[${automation}] ${message}`, metadata: { automation, ...metadata } });

// One in-flight agent run per ticket per automation, persisted so concurrent or restarted
// ticks reconcile the same run instead of starting a duplicate. Best-effort only —
// correctness comes from conditional status transitions, not from this bookkeeping.
export interface PendingRun {
  ticketId: string;
  sessionId: string;
  startedAt: string;
}

const pendingRuns = (storage: ExtensionStorageApi, automation: string) =>
  storage.collection<PendingRun>(`pending-runs-${automation}`);

export const listPendingRuns = (ctx: AutomationContext, automation: string) =>
  pendingRuns(ctx.storage, automation).list();

export const savePendingRun = (ctx: AutomationContext, automation: string, run: PendingRun) =>
  pendingRuns(ctx.storage, automation).put(run.ticketId, run);

export const clearPendingRun = (ctx: AutomationContext, automation: string, ticketId: string) =>
  pendingRuns(ctx.storage, automation).delete(ticketId);

const liveSessionStatuses = new Set(["queued", "in_progress", "awaiting_input"]);

export const isSessionLive = (status: string | undefined) => status !== undefined && liveSessionStatuses.has(status);

// Re-reads the ticket and only moves it when it still sits in the expected source
// status, so concurrent ticks and human edits win over stale automation decisions.
export const moveTicketIfStillIn = async (
  ctx: AutomationContext,
  input: { ticketId: string; fromStatusId: string; toStatusId: string },
) => {
  const ticket = await executePlanner(ctx, planner.getTicket, { id: input.ticketId });
  if (!ticket || ticket.statusId !== input.fromStatusId) return false;

  await executePlanner(ctx, planner.setTicketAttribute, {
    rowId: ticket.id,
    attributeId: "status",
    value: input.toStatusId,
  });
  return true;
};

// Automation adds human_requested to hand work back to a human; it never clears it.
export const addHumanRequested = async (ctx: AutomationContext, ticketId: string) => {
  const { tags } = await executePlanner(ctx, planner.readTags, {});
  const tag = tags.find((candidate) => candidate.name.trim().toLowerCase() === "human_requested");
  const option = tag?.options[0];
  if (!tag || !option) return false;

  await executePlanner(ctx, planner.setTicketAttribute, {
    rowId: ticketId,
    attributeId: tag.id,
    value: option.id,
  });
  return true;
};
