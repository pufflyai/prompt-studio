import { defineCommand } from "@pstdio/sdk/extensions";
import { maxInProgress, recordAutomationActivity } from "../automation-run";
import { executePlanner, planner } from "../planner-client";
import { automatable, byPriorityThenCreatedAt, statusIdByNames } from "../selection";

const AUTOMATION = "implement-tickets";

export const implementTicketsCommand = defineCommand({
  title: "Implement ready tickets",
  cli: true,
  async run(ctx) {
    const [{ statuses }, { tags }, tickets, cap] = await Promise.all([
      executePlanner(ctx, planner.readStatuses, {}),
      executePlanner(ctx, planner.readTags, {}),
      executePlanner(ctx, planner.readTickets, {}),
      maxInProgress(ctx),
    ]);
    const readyId = statusIdByNames(statuses, ["TODO", "Ready"]);
    const inProgressId = statusIdByNames(statuses, ["In Progress", "wip"]);
    if (!readyId || !inProgressId) return { ran: false, reason: "TODO/In Progress statuses not found" };

    const inProgressCount = tickets.filter((ticket) => !ticket.draft && ticket.statusId === inProgressId).length;
    const capacity = cap - inProgressCount;
    if (capacity <= 0) {
      await recordAutomationActivity(ctx, AUTOMATION, `at capacity: ${inProgressCount}/${cap} in progress`);
      return { ran: true, implemented: [], inProgressCount };
    }

    const selected = automatable(tickets, tags)
      .filter((ticket) => ticket.statusId === readyId)
      .sort(byPriorityThenCreatedAt(tags))
      .slice(0, capacity);
    if (selected.length === 0) {
      await recordAutomationActivity(ctx, AUTOMATION, "no eligible TODO ticket");
      return { ran: true, implemented: [], inProgressCount };
    }

    // run-attempt creates an anchored workspace and implementation session, then
    // moves the ticket to In Progress through the planner-owned command path.
    for (const ticket of selected) {
      await executePlanner(ctx, planner.runAttempt, { ticket: ticket.shorthand });
      await recordAutomationActivity(ctx, AUTOMATION, `started implementation for ${ticket.shorthand}`, {
        ticketId: ticket.id,
      });
    }

    return { ran: true, implemented: selected.map((ticket) => ticket.shorthand), inProgressCount };
  },
});
