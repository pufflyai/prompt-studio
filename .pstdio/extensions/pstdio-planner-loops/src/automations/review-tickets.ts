import { defineCommand } from "@pstdio/sdk/extensions";
import { recordAutomationActivity } from "../automation-run";
import { executePlanner, planner } from "../planner-client";
import { automatable } from "../selection";

const AUTOMATION = "review-tickets";

export const reviewTicketsCommand = defineCommand({
  title: "Review ready attempt revisions",
  cli: true,
  async run(ctx) {
    const attempts = await executePlanner(ctx, planner.listAttempts, {});
    const reconciled = [];
    for (const attempt of attempts.filter((candidate) => candidate.state === "reviewing")) {
      const result = await executePlanner(ctx, planner.reconcileAttempt, { workspaceId: attempt.workspaceId });
      reconciled.push({ workspaceId: attempt.workspaceId, decision: result.decision });
      await recordAutomationActivity(ctx, AUTOMATION, `reconciled ${attempt.workspaceShorthand}: ${result.decision}`, {
        workspaceId: attempt.workspaceId,
        decision: result.decision,
      });
    }

    const [{ tags }, tickets, currentAttempts] = await Promise.all([
      executePlanner(ctx, planner.readTags, {}),
      executePlanner(ctx, planner.readTickets, {}),
      executePlanner(ctx, planner.listAttempts, {}),
    ]);
    const eligibleTicketIds = new Set(automatable(tickets, tags).map((ticket) => ticket.id));
    const candidate = currentAttempts
      .filter((attempt) => attempt.state === "review_ready" && eligibleTicketIds.has(attempt.ticketId))
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))[0];
    if (!candidate) {
      await recordAutomationActivity(ctx, AUTOMATION, "no review-ready attempt revision");
      return { ran: true, reviewed: null, reconciled };
    }

    const revision = candidate.revisions.at(-1);
    if (!revision) throw new Error(`Attempt ${candidate.workspaceShorthand} has no revision.`);
    const started = await executePlanner(ctx, planner.runReview, {
      workspaceId: candidate.workspaceId,
      expectedRevision: revision.revision,
    });
    await recordAutomationActivity(ctx, AUTOMATION, `started review for ${candidate.workspaceShorthand}`, {
      ticketId: candidate.ticketId,
      workspaceId: candidate.workspaceId,
      reviewId: started.review.id,
      sessionId: started.session.id,
      revision: revision.revision,
      headSha: revision.headSha,
    });
    return { ran: true, reviewed: candidate.ticketShorthand, workspaceId: candidate.workspaceId, reconciled };
  },
});
