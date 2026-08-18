import { defineCommand } from "@pstdio/sdk/extensions";
import { recordAutomationActivity } from "../automation-run";
import { executePlanner, planner } from "../planner-client";
import { automatable, byPriorityThenCreatedAt, statusIdByNames } from "../selection";

const AUTOMATION = "implement-tickets";

export const implementTicketsCommand = defineCommand({
  title: "Implement Todo tickets",
  cli: true,
  async run(ctx) {
    const [{ statuses }, { tags }, tickets] = await Promise.all([
      executePlanner(ctx, planner.readStatuses, {}),
      executePlanner(ctx, planner.readTags, {}),
      executePlanner(ctx, planner.readTickets, {}),
    ]);
    const readyId = statusIdByNames(statuses, ["TODO", "Ready"]);
    if (!readyId) return { ran: false, reason: "TODO/Ready status not found" };

    const selected = automatable(tickets, tags)
      .filter((ticket) => ticket.statusId === readyId)
      .sort(byPriorityThenCreatedAt(tags));
    if (selected.length === 0) {
      await recordAutomationActivity(ctx, AUTOMATION, "no eligible TODO ticket");
      return { ran: true, implemented: [], waits: [] };
    }

    // run-attempt creates an anchored workspace and implementation session, then
    // moves the ticket to In Progress through the planner-owned command path.
    const implemented: string[] = [];
    const waits: Array<{ ticket: string; reason: string }> = [];
    for (const ticket of selected) {
      const result = await executePlanner(ctx, planner.runAttempt, { ticket: ticket.shorthand });
      if (result.decision === "started") {
        implemented.push(ticket.shorthand);
        await recordAutomationActivity(ctx, AUTOMATION, `started implementation for ${ticket.shorthand}`, {
          ticketId: ticket.id,
          workspaceId: result.attempt.workspaceId,
        });
        continue;
      }
      waits.push({ ticket: ticket.shorthand, reason: result.reason });
      await recordAutomationActivity(ctx, AUTOMATION, `waited on ${ticket.shorthand}: ${result.reason}`, {
        ticketId: ticket.id,
        reason: result.reason,
        dependencyIds: result.dependencyIds,
      });
      if (result.reason === "capacity-full") break;
    }

    return { ran: true, implemented, waits };
  },
});
