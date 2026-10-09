// Return the execution plan with its deadlines, blockers, risk, and the Planner tags tracks can use.
import { defineCommand } from "@pstdio/sdk/extensions";
import { queryTickets } from "../../commands/query-tickets";
import { readTicketTags } from "../../data/tag-operations";
import { buildPlan } from "../model/build-plan";
import { readActionStore } from "./action-store";
import { readGates } from "./gate-store";
import { loadPlan } from "./plan-store";
import { readTrack } from "./track-commands";

// Deadlines are calendar days for the person reading them, so today uses the local date.
const localToday = () => new Intl.DateTimeFormat("en-CA").format(new Date());

export const readPlanCommand = defineCommand({
  id: "timeline.plan.read",
  title: "Read execution plan",
  cli: { description: "Print the execution order, deadlines, blockers, and risk as JSON." },
  async run(ctx) {
    const [loaded, { tags }, { rows: ticketRows }] = await Promise.all([
      loadPlan(ctx),
      readTicketTags(ctx.storage),
      queryTickets(ctx, { filters: { archived: ["active"] } }),
    ]);
    const [actions, gates, track] = await Promise.all([readActionStore(ctx), readGates(ctx), readTrack(ctx)]);
    return {
      ...buildPlan({ ...loaded, actions, gates, track, tags, today: localToday() }),
      projectId: ctx.projectId,
      ticketRows,
    };
  },
});
