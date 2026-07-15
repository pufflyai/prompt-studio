import { defineCommand } from "@pstdio/sdk/extensions";
import {
  type AutomationContext,
  addHumanRequested,
  automationEnabled,
  clearPendingRun,
  isSessionLive,
  listPendingRuns,
  moveTicketIfStillIn,
  recordAutomationActivity,
  savePendingRun,
} from "../automation-run";
import { executePlanner, type PlannerTicket, planner } from "../planner-client";
import { automatable, byUpdatedAtAsc, statusIdByNames } from "../selection";

const AUTOMATION = "review-tickets";

// Review sessions finish after the tick that starts them. A later tick applies the
// outcome: a completed review of a ticket still In Review passes (hand back to a
// human via human_requested); a review that died sends the ticket back to
// In Progress. A reviewer that already moved the ticket out of In Review wins.
const reconcilePendingReviews = async (ctx: AutomationContext, inReviewId: string, inProgressId: string) => {
  const stillRunning = new Set<string>();

  for (const run of await listPendingRuns(ctx, AUTOMATION)) {
    const session = await ctx.sessions.get(run.sessionId);
    if (isSessionLive(session?.status)) {
      stillRunning.add(run.ticketId);
      continue;
    }

    await clearPendingRun(ctx, AUTOMATION, run.ticketId);
    if (session?.status === "completed") {
      const ticket = await executePlanner(ctx, planner.getTicket, { id: run.ticketId });
      const passed = ticket?.statusId === inReviewId;
      if (passed) await addHumanRequested(ctx, run.ticketId);
      await recordAutomationActivity(ctx, AUTOMATION, `review completed for ${run.ticketId}`, { passed, ...run });
    } else {
      const moved = await moveTicketIfStillIn(ctx, {
        ticketId: run.ticketId,
        fromStatusId: inReviewId,
        toStatusId: inProgressId,
      });
      await recordAutomationActivity(ctx, AUTOMATION, `review did not complete for ${run.ticketId}`, {
        sessionStatus: session?.status ?? "missing",
        moved,
        ...run,
      });
    }
  }

  return stillRunning;
};

const allWorkspacesInactive = async (ctx: AutomationContext, ticket: PlannerTicket) => {
  const workspaces = await executePlanner(ctx, planner.ticketWorkspaces, { id: ticket.shorthand });
  if (workspaces.length === 0) return { workspaces, inactive: false };

  for (const workspace of workspaces) {
    const activity = await executePlanner(ctx, planner.workspaceActivity, { workspaceId: workspace.id });
    if (activity.active) return { workspaces, inactive: false };
  }
  return { workspaces, inactive: true };
};

export const reviewTicketsCommand = defineCommand({
  title: "Review in-review tickets",
  cli: true,
  async run(ctx) {
    if (!(await automationEnabled(ctx))) return { ran: false, reason: "automation.enabled is off" };

    const [{ statuses }, { tags }] = await Promise.all([
      executePlanner(ctx, planner.readStatuses, {}),
      executePlanner(ctx, planner.readTags, {}),
    ]);
    const inReviewId = statusIdByNames(statuses, ["In Review", "review"]);
    const inProgressId = statusIdByNames(statuses, ["In Progress", "wip"]);
    if (!inReviewId || !inProgressId) return { ran: false, reason: "In Review/In Progress statuses not found" };

    const stillRunning = await reconcilePendingReviews(ctx, inReviewId, inProgressId);

    const tickets = await executePlanner(ctx, planner.readTickets, {});
    const candidates = automatable(tickets, tags)
      .filter((ticket) => ticket.statusId === inReviewId && !stillRunning.has(ticket.id))
      .sort(byUpdatedAtAsc);

    for (const candidate of candidates) {
      const { workspaces, inactive } = await allWorkspacesInactive(ctx, candidate);
      if (!inactive) continue;

      const session = await executePlanner(ctx, planner.runReview, {
        workspaceId: workspaces[0].id,
        ticket: candidate.shorthand,
      });
      await savePendingRun(ctx, AUTOMATION, {
        ticketId: candidate.id,
        sessionId: session.id,
        startedAt: new Date().toISOString(),
      });
      await recordAutomationActivity(ctx, AUTOMATION, `started review for ${candidate.shorthand}`, {
        ticketId: candidate.id,
        sessionId: session.id,
      });
      return { ran: true, reviewed: candidate.shorthand };
    }

    await recordAutomationActivity(ctx, AUTOMATION, "no eligible In Review ticket");
    return { ran: true, reviewed: null };
  },
});
