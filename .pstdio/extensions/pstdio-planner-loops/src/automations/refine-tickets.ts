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
import { executePlanner, planner } from "../planner-client";
import { automatable, byUpdatedAtAsc, statusIdByNames } from "../selection";

const AUTOMATION = "refine-tickets";

// Refinement sessions finish long after the tick that starts them, so outcomes are
// applied by a later tick: completed sessions promote the ticket, everything else
// releases it back to selection.
const reconcilePendingRefinements = async (ctx: AutomationContext, backlogId: string, readyId: string) => {
  let running = 0;

  for (const run of await listPendingRuns(ctx, AUTOMATION)) {
    const session = await ctx.sessions.get(run.sessionId);
    if (isSessionLive(session?.status)) {
      running += 1;
      continue;
    }

    await clearPendingRun(ctx, AUTOMATION, run.ticketId);
    if (session?.status === "completed") {
      const moved = await moveTicketIfStillIn(ctx, {
        ticketId: run.ticketId,
        fromStatusId: backlogId,
        toStatusId: readyId,
      });
      if (moved) await addHumanRequested(ctx, run.ticketId);
      await recordAutomationActivity(ctx, AUTOMATION, `refinement completed for ${run.ticketId}`, { moved, ...run });
    } else {
      await recordAutomationActivity(ctx, AUTOMATION, `refinement did not complete for ${run.ticketId}`, {
        sessionStatus: session?.status ?? "missing",
        ...run,
      });
    }
  }

  return running;
};

export const refineTicketsCommand = defineCommand({
  title: "Refine backlog tickets",
  cli: true,
  async run(ctx) {
    if (!(await automationEnabled(ctx))) return { ran: false, reason: "automation.enabled is off" };

    const [{ statuses }, { tags }] = await Promise.all([
      executePlanner(ctx, planner.readStatuses, {}),
      executePlanner(ctx, planner.readTags, {}),
    ]);
    const backlogId = statusIdByNames(statuses, ["Backlog"]);
    const readyId = statusIdByNames(statuses, ["Ready"]);
    if (!backlogId || !readyId) return { ran: false, reason: "Backlog/Ready statuses not found" };

    const running = await reconcilePendingRefinements(ctx, backlogId, readyId);
    if (running > 0) {
      await recordAutomationActivity(ctx, AUTOMATION, `skipped selection: ${running} refinement(s) still running`);
      return { ran: true, refined: null, running };
    }

    const tickets = await executePlanner(ctx, planner.readTickets, {});
    const candidate = automatable(tickets, tags)
      .filter((ticket) => ticket.statusId === backlogId)
      .sort(byUpdatedAtAsc)[0];
    if (!candidate) {
      await recordAutomationActivity(ctx, AUTOMATION, "no eligible Backlog ticket");
      return { ran: true, refined: null, running: 0 };
    }

    const session = await executePlanner(ctx, planner.refineTicket, { ticket: candidate.shorthand });
    await savePendingRun(ctx, AUTOMATION, {
      ticketId: candidate.id,
      sessionId: session.id,
      startedAt: new Date().toISOString(),
    });
    await recordAutomationActivity(ctx, AUTOMATION, `started refinement for ${candidate.shorthand}`, {
      ticketId: candidate.id,
      sessionId: session.id,
    });

    return { ran: true, refined: candidate.shorthand, running: 1 };
  },
});
