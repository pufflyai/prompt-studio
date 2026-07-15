import { defineCommand } from "@pstdio/sdk/extensions";
import {
  type AutomationContext,
  automationEnabled,
  moveTicketIfStillIn,
  recordAutomationActivity,
} from "../automation-run";
import { executePlanner, type PlannerTicket, planner, type WorkspaceActivitySession } from "../planner-client";
import { automatable, statusIdByNames } from "../selection";

const AUTOMATION = "stuck-work-sweep";
const STUCK_AFTER_MS = 60 * 60 * 1000;

const FAILED_SESSION_STATUSES = new Set(["failed", "disconnected", "cancelled"]);

const latestSession = (sessions: WorkspaceActivitySession[]) =>
  sessions
    .slice()
    .sort((a, b) => (a.createdAt ?? a.updatedAt ?? "").localeCompare(b.createdAt ?? b.updatedAt ?? ""))
    .at(-1);

const sweepTicket = async (
  ctx: AutomationContext,
  ticket: PlannerTicket,
  statusIds: { inProgressId: string; blockedId: string; inReviewId: string },
) => {
  const workspaces = await executePlanner(ctx, planner.ticketWorkspaces, { id: ticket.shorthand });
  if (workspaces.length === 0) {
    await recordAutomationActivity(ctx, AUTOMATION, `no workspaces linked to ${ticket.shorthand}`, {
      ticketId: ticket.id,
    });
    return { ticket: ticket.shorthand, decision: "no-workspaces" };
  }

  const activities = [];
  for (const workspace of workspaces) {
    activities.push(await executePlanner(ctx, planner.workspaceActivity, { workspaceId: workspace.id }));
  }
  if (activities.some((activity) => activity.active)) return { ticket: ticket.shorthand, decision: "active" };

  const latest = latestSession(activities.flatMap((activity) => activity.sessions));
  if (!latest) {
    await recordAutomationActivity(ctx, AUTOMATION, `no sessions recorded for ${ticket.shorthand}`, {
      ticketId: ticket.id,
    });
    return { ticket: ticket.shorthand, decision: "no-sessions" };
  }

  if (FAILED_SESSION_STATUSES.has(latest.status)) {
    const moved = await moveTicketIfStillIn(ctx, {
      ticketId: ticket.id,
      fromStatusId: statusIds.inProgressId,
      toStatusId: statusIds.blockedId,
    });
    await recordAutomationActivity(
      ctx,
      AUTOMATION,
      `moved ${ticket.shorthand} to Blocked after ${latest.status} session`,
      {
        ticketId: ticket.id,
        sessionId: latest.id,
        moved,
      },
    );
    return { ticket: ticket.shorthand, decision: "blocked" };
  }

  if (latest.status === "completed") {
    const moved = await moveTicketIfStillIn(ctx, {
      ticketId: ticket.id,
      fromStatusId: statusIds.inProgressId,
      toStatusId: statusIds.inReviewId,
    });
    await recordAutomationActivity(ctx, AUTOMATION, `moved ${ticket.shorthand} to In Review after completed session`, {
      ticketId: ticket.id,
      sessionId: latest.id,
      moved,
    });
    return { ticket: ticket.shorthand, decision: "in-review" };
  }

  return { ticket: ticket.shorthand, decision: "unchanged" };
};

export const stuckWorkSweepCommand = defineCommand({
  title: "Sweep stuck in-progress tickets",
  cli: true,
  async run(ctx) {
    if (!(await automationEnabled(ctx))) return { ran: false, reason: "automation.enabled is off" };

    const [{ statuses }, { tags }, tickets] = await Promise.all([
      executePlanner(ctx, planner.readStatuses, {}),
      executePlanner(ctx, planner.readTags, {}),
      executePlanner(ctx, planner.readTickets, {}),
    ]);
    const inProgressId = statusIdByNames(statuses, ["In Progress", "wip"]);
    const blockedId = statusIdByNames(statuses, ["Blocked"]);
    const inReviewId = statusIdByNames(statuses, ["In Review", "review"]);
    if (!inProgressId || !blockedId || !inReviewId) {
      return { ran: false, reason: "In Progress/Blocked/In Review statuses not found" };
    }

    const stuckSince = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
    const stuck = automatable(tickets, tags).filter(
      (ticket) => ticket.statusId === inProgressId && ticket.updatedAt < stuckSince,
    );

    const decisions = [];
    for (const ticket of stuck) {
      decisions.push(await sweepTicket(ctx, ticket, { inProgressId, blockedId, inReviewId }));
    }
    if (stuck.length === 0) await recordAutomationActivity(ctx, AUTOMATION, "no stuck In Progress tickets");

    return { ran: true, decisions };
  },
});
