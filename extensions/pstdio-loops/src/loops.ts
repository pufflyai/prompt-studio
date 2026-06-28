import type { CommandContext, ExtensionWorkspace } from "@pstdio/sdk/extensions";
import {
  implementTicketRef,
  type PlannerTag,
  type PlannerTicket,
  refineTicketRef,
  runReviewRef,
  setTicketAttributeRef,
} from "./planner-commands";
import {
  fetchTags,
  fetchTickets,
  fetchWorkspaceActivity,
  findHumanRequestedOptionId,
  hasTagOption,
} from "./planner-data";
import { readAutomationStatusIds } from "./settings";

export type LoopCtx = CommandContext;
type Ctx = LoopCtx;

interface LoopWorld {
  statusIds: Awaited<ReturnType<typeof readAutomationStatusIds>>;
  tags: PlannerTag[];
  tickets: PlannerTicket[];
  humanRequestedOptionId: string | undefined;
}

const loadWorld = async (ctx: Ctx): Promise<LoopWorld> => {
  const [statusIds, tags, tickets] = await Promise.all([
    readAutomationStatusIds(ctx.settings),
    fetchTags(ctx.commands),
    fetchTickets(ctx.commands),
  ]);
  return { statusIds, tags, tickets, humanRequestedOptionId: findHumanRequestedOptionId(tags) };
};

const oldestUpdated = (a: PlannerTicket, b: PlannerTicket) => a.updatedAt.localeCompare(b.updatedAt);

const eligibleForRefinement = (world: LoopWorld) => {
  return world.tickets
    .filter((ticket) => ticket.statusId === world.statusIds.refine)
    .filter((ticket) => !hasTagOption(ticket, world.humanRequestedOptionId))
    .sort(oldestUpdated);
};

const eligibleForImplementation = (world: LoopWorld) => {
  const priorityTag = world.tags.find((tag) => tag.name.toLowerCase() === "priority");
  const priorityOrder = new Map(priorityTag?.options.map((option) => [option.id, option.sortOrder]) ?? []);
  const tickets = world.tickets
    .filter((ticket) => ticket.statusId === world.statusIds.ready)
    .filter((ticket) => !hasTagOption(ticket, world.humanRequestedOptionId));

  return [...tickets].sort((a, b) => {
    const priorityA = (a.tagIds ?? []).map((id) => priorityOrder.get(id)).find((order) => order !== undefined);
    const priorityB = (b.tagIds ?? []).map((id) => priorityOrder.get(id)).find((order) => order !== undefined);
    // Higher sortOrder == higher urgency (`Urgent` has sortOrder 3); break ties on createdAt.
    if ((priorityA ?? -1) !== (priorityB ?? -1)) return (priorityB ?? -1) - (priorityA ?? -1);
    return a.createdAt.localeCompare(b.createdAt);
  });
};

const inProgressCount = (world: LoopWorld) => {
  return world.tickets.filter((ticket) => ticket.statusId === world.statusIds.inProgress).length;
};

const ticketWorkspaces = async (ctx: Ctx, ticket: PlannerTicket): Promise<ExtensionWorkspace[]> => {
  const all = await ctx.workspaces.list();
  return all.filter((workspace) => {
    const anchor = workspace.anchors_json?.find((entry) => entry.type === "ticket");
    if (!anchor) return false;
    return anchor.id === ticket.id || anchor.metadata?.shorthand === ticket.shorthand;
  });
};

interface SweepDecision {
  ticketId: string;
  shorthand: string;
  action: "blocked" | "in_review" | "left_in_progress" | "no_sessions";
}

const setStatus = async (ctx: Ctx, ticket: PlannerTicket, statusId: string) => {
  await ctx.commands.execute(setTicketAttributeRef, {
    params: { rowId: ticket.id, attributeId: "status", value: statusId },
  });
};

const addTag = async (ctx: Ctx, ticket: PlannerTicket, optionId: string) => {
  if ((ticket.tagIds ?? []).includes(optionId)) return;
  // set-ticket-attribute treats single_select tag attributes as the option id.
  await ctx.commands.execute(setTicketAttributeRef, {
    params: { rowId: ticket.id, attributeId: optionId, value: optionId },
  });
};

const automationsEnabled = async (ctx: Ctx) => Boolean(await ctx.settings.get("automations.enabled" as never));

const maxInProgressSetting = async (ctx: Ctx) => {
  const raw = await ctx.settings.get("automations.maxInProgress" as never);
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 5;
};

export const refinementSweepRun = async (ctx: Ctx) => {
  if (!(await automationsEnabled(ctx))) {
    await ctx.activity.record({ message: "Refinement sweep skipped: automations disabled." });
    return { picked: 0 };
  }
  const world = await loadWorld(ctx);
  const candidates = eligibleForRefinement(world);
  if (candidates.length === 0) {
    await ctx.activity.record({ message: "Refinement sweep: no eligible tickets." });
    return { picked: 0 };
  }
  const ticket = candidates[0];

  try {
    await ctx.commands.execute(refineTicketRef, { params: { ticket: ticket.shorthand } });
    await setStatus(ctx, ticket, world.statusIds.ready);
    if (world.humanRequestedOptionId) await addTag(ctx, ticket, world.humanRequestedOptionId);
    await ctx.activity.record({
      message: `Refined ${ticket.shorthand}; moved to Ready and tagged human_requested.`,
      metadata: { ticketId: ticket.id },
    });
    return { picked: 1, ticket: ticket.shorthand, refined: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.activity.record({
      message: `Refinement failed for ${ticket.shorthand}: ${message}`,
      metadata: { ticketId: ticket.id, error: message },
    });
    return { picked: 1, ticket: ticket.shorthand, refined: false, error: message };
  }
};

export const implementationTickRun = async (ctx: Ctx) => {
  if (!(await automationsEnabled(ctx))) {
    await ctx.activity.record({ message: "Implementation tick skipped: automations disabled." });
    return { picked: 0 };
  }
  const maxInProgress = await maxInProgressSetting(ctx);
  const world = await loadWorld(ctx);
  const current = inProgressCount(world);
  const capacity = Math.max(0, maxInProgress - current);
  if (capacity === 0) {
    await ctx.activity.record({
      message: `Implementation tick: cap reached (${current}/${maxInProgress}).`,
      metadata: { inProgress: current, maxInProgress },
    });
    return { picked: 0 };
  }

  const candidates = eligibleForImplementation(world).slice(0, capacity);
  if (candidates.length === 0) {
    await ctx.activity.record({ message: "Implementation tick: no eligible Ready tickets." });
    return { picked: 0 };
  }

  for (const ticket of candidates) {
    // Re-read each ticket's status before dispatching so a concurrent tick that
    // already picked the same row does not double-spawn.
    const latest = await fetchTickets(ctx.commands);
    const fresh = latest.find((candidate) => candidate.id === ticket.id);
    if (!fresh || fresh.statusId !== world.statusIds.ready) continue;
    try {
      await ctx.commands.execute(implementTicketRef, { params: { ticket: ticket.shorthand } });
      await ctx.activity.record({
        message: `Implementation tick picked ${ticket.shorthand}.`,
        metadata: { ticketId: ticket.id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.activity.record({
        message: `Implementation tick failed for ${ticket.shorthand}: ${message}`,
        metadata: { ticketId: ticket.id, error: message },
      });
    }
  }

  return { picked: candidates.length };
};

const decideStuckTransition = (
  workspaces: ExtensionWorkspace[],
  activitiesByWorkspace: Record<string, { active: boolean; sessions: Array<{ status: string; updatedAt: string }> }>,
) => {
  if (workspaces.length === 0) return { transition: "no_sessions" as const };
  const allInactive = workspaces.every((workspace) => !activitiesByWorkspace[workspace.id]?.active);
  if (!allInactive) return { transition: "left_in_progress" as const };

  // Pick the most-recent terminal session across all workspaces.
  const allSessions = workspaces.flatMap((workspace) => activitiesByWorkspace[workspace.id]?.sessions ?? []);
  if (allSessions.length === 0) return { transition: "no_sessions" as const };
  const latest = [...allSessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (latest.status === "completed") return { transition: "in_review" as const };
  if (latest.status === "failed" || latest.status === "disconnected" || latest.status === "cancelled") {
    return { transition: "blocked" as const };
  }
  return { transition: "left_in_progress" as const };
};

const STUCK_GRACE_MS = 60 * 60 * 1000;

export const stuckWorkSweepRun = async (ctx: Ctx) => {
  if (!(await automationsEnabled(ctx))) {
    await ctx.activity.record({ message: "Stuck sweep skipped: automations disabled." });
    return { picked: 0 };
  }
  const world = await loadWorld(ctx);
  const cutoff = Date.now() - STUCK_GRACE_MS;
  const candidates = world.tickets.filter((ticket) => {
    if (ticket.statusId !== world.statusIds.inProgress) return false;
    return new Date(ticket.updatedAt).getTime() < cutoff;
  });
  if (candidates.length === 0) {
    await ctx.activity.record({ message: "Stuck sweep: no aged In Progress tickets." });
    return { picked: 0 };
  }

  const decisions: SweepDecision[] = [];
  for (const ticket of candidates) {
    const workspaces = await ticketWorkspaces(ctx, ticket);
    const activity: Record<string, { active: boolean; sessions: Array<{ status: string; updatedAt: string }> }> = {};
    for (const workspace of workspaces) {
      activity[workspace.id] = await fetchWorkspaceActivity(ctx.commands, workspace.id);
    }
    const { transition } = decideStuckTransition(workspaces, activity);
    if (transition === "blocked") {
      await setStatus(ctx, ticket, world.statusIds.blocked);
    } else if (transition === "in_review") {
      await setStatus(ctx, ticket, world.statusIds.inReview);
    }
    decisions.push({ ticketId: ticket.id, shorthand: ticket.shorthand, action: transition });
    await ctx.activity.record({
      message: `Stuck sweep ${transition} for ${ticket.shorthand}.`,
      metadata: { ticketId: ticket.id, action: transition },
    });
  }
  return { picked: candidates.length, decisions };
};

export const reviewTickRun = async (ctx: Ctx) => {
  if (!(await automationsEnabled(ctx))) {
    await ctx.activity.record({ message: "Review tick skipped: automations disabled." });
    return { picked: 0 };
  }
  const world = await loadWorld(ctx);

  const candidates = world.tickets
    .filter((ticket) => ticket.statusId === world.statusIds.inReview)
    .filter((ticket) => !hasTagOption(ticket, world.humanRequestedOptionId))
    .sort(oldestUpdated);

  for (const ticket of candidates) {
    const workspaces = await ticketWorkspaces(ctx, ticket);
    if (workspaces.length === 0) continue;
    const activities = await Promise.all(
      workspaces.map((workspace) => fetchWorkspaceActivity(ctx.commands, workspace.id)),
    );
    if (activities.some((activity) => activity.active)) continue;

    try {
      await ctx.commands.execute(runReviewRef, { params: { ticket: ticket.shorthand } });
      if (world.humanRequestedOptionId) await addTag(ctx, ticket, world.humanRequestedOptionId);
      await ctx.activity.record({
        message: `Review tick handed ${ticket.shorthand} back to a human (review run).`,
        metadata: { ticketId: ticket.id },
      });
      return { picked: 1, ticket: ticket.shorthand, outcome: "review-run" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await setStatus(ctx, ticket, world.statusIds.inProgress);
      await ctx.activity.record({
        message: `Review tick failed for ${ticket.shorthand}; moved back to In Progress.`,
        metadata: { ticketId: ticket.id, error: message },
      });
      return { picked: 1, ticket: ticket.shorthand, outcome: "review-failed", error: message };
    }
  }
  await ctx.activity.record({ message: "Review tick: no eligible tickets with all workspaces inactive." });
  return { picked: 0 };
};

// Status-change reaction: when a ticket transitions into Refine, immediately
// run the refinement sweep so the operator sees movement without waiting for
// the next cron tick. The sweep itself re-reads state, so the per-tick
// idempotency rules apply here too.
export const onTicketEnteredRefine = async (ctx: Ctx, ticketShorthand: string) => {
  await ctx.activity.record({
    message: `Refinement triggered for ${ticketShorthand} on status change.`,
    metadata: { ticketShorthand },
  });
  return refinementSweepRun(ctx);
};
