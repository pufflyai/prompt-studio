import { defineCommand } from "@pstdio/sdk/extensions";
import { recordAutomationActivity } from "../automation-run";
import { executePlanner, planner } from "../planner-client";

const AUTOMATION = "stuck-work-sweep";
const reconcilableStates = new Set(["implementing", "changes_requested", "reviewing"]);

export const stuckWorkSweepCommand = defineCommand({
  title: "Reconcile managed attempts",
  cli: true,
  async run(ctx, _commandParams) {
    const attempts = await executePlanner(ctx, planner.listAttempts, {});
    const decisions = [];
    for (const attempt of attempts.filter((candidate) => reconcilableStates.has(candidate.state))) {
      const result = await executePlanner(ctx, planner.reconcileAttempt, { workspaceId: attempt.workspaceId });
      decisions.push({
        ticket: attempt.ticketShorthand,
        workspaceId: attempt.workspaceId,
        decision: result.decision,
      });
      await recordAutomationActivity(ctx, AUTOMATION, `reconciled ${attempt.workspaceShorthand}: ${result.decision}`, {
        ticketId: attempt.ticketId,
        workspaceId: attempt.workspaceId,
        decision: result.decision,
      });
    }
    if (decisions.length === 0) await recordAutomationActivity(ctx, AUTOMATION, "no managed attempts to reconcile");
    return { ran: true, decisions };
  },
});
