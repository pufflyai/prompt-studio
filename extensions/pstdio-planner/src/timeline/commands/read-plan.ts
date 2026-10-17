// Return the execution plan with its deadlines, blockers, risk, and the Planner tags tracks can use.
import { defineCommand } from "@pstdio/sdk/extensions";
import { queryTickets } from "../../commands/query-tickets";
import { listAttempts } from "../../data/attempt-storage";
import { buildTicketAttributes } from "../../data/mappers";
import { readTicketReviewRequests } from "../../data/review-request-storage";
import { readTicketTags } from "../../data/tag-operations";
import { buildPlan } from "../model/build-plan";
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
    const [loaded, { tags }, { rows: ticketRows, attributes }] = await Promise.all([
      loadPlan(ctx),
      readTicketTags(ctx.storage),
      queryTickets(ctx, {
        filter: { conjunction: "and", rules: [{ attributeId: "archived", condition: "is-any-of", value: ["active"] }] },
      }),
    ]);
    const [requests, gates, track, attempts] = await Promise.all([
      readTicketReviewRequests(ctx.storage),
      readGates(ctx),
      readTrack(ctx),
      listAttempts(ctx.storage),
    ]);
    return {
      ...buildPlan({ ...loaded, requests, gates, track, tags, attempts, now: Date.now(), today: localToday() }),
      projectId: ctx.projectId,
      ticketRows,
      ticketAttributes:
        attributes?.map((attribute) =>
          attribute.type.kind === "status" ? buildTicketAttributes(loaded.statuses)[0]! : attribute,
        ) ?? [],
    };
  },
});
