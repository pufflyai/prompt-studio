// Return the execution plan with its deadlines, blockers, risk, and the Planner tags tracks can use.
import { defineCommand } from "@pstdio/sdk/extensions";
import { listAttempts } from "../../data/attempt-storage";
import { readTicketSnapshot } from "../../data/collections";
import {
  buildTicketAttributes,
  createTicketParentLookup,
  createTicketRowMapper,
  createTicketWorkspaceLookup,
} from "../../data/mappers";
import { migratePlannerStorage } from "../../data/migrate-storage";
import { hasPendingInput } from "../../data/review-request-storage";
import { readTicketStatuses } from "../../data/status-operations";
import { readTicketTags } from "../../data/tag-operations";
import { timelineBoard } from "../../data/ticket-board";
import { ticketActivationTarget } from "../../data/ticket-page-target";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../../data/workflow-statuses";
import { sortedBySortOrder } from "../../utils/sort";
import { buildPlan } from "../model/build-plan";
import { resolvePlan } from "../model/resolve-plan";
import { timelineTicketProperties } from "../model/ticket-properties";
import { readGates } from "./gate-store";
import { readStoredPlan } from "./plan-store";
import { readTrack } from "./track-commands";

// Deadlines are calendar days for the person reading them, so today uses the local date.
const localToday = () => new Intl.DateTimeFormat("en-CA").format(new Date());

export const readPlanCommand = defineCommand({
  id: "timeline.plan.read",
  title: "Read execution plan",
  cli: { description: "Print the execution order, deadlines, blockers, and risk as JSON." },
  async run(ctx) {
    await migratePlannerStorage(ctx);
    const [{ tickets, requests }, { statuses }, { tags }, stored, gates, attempts, workspaces, selections] =
      await Promise.all([
        readTicketSnapshot(ctx.storage),
        readTicketStatuses(ctx.storage),
        readTicketTags(ctx.storage),
        readStoredPlan(ctx.storage),
        readGates(ctx),
        listAttempts(ctx.storage),
        ctx.workspaces.list(),
        readWorkflowStatuses(ctx),
      ]);
    const workflow = usableWorkflowStatuses(selections);
    const active = sortedBySortOrder(tickets.filter((ticket) => !ticket.archived));
    const plan = buildPlan({
      tickets: active,
      statuses,
      tags,
      requests,
      gates,
      attempts,
      workflow,
      track: await readTrack(ctx, tags),
      plan: resolvePlan(stored, active, statuses, workflow),
      now: Date.now(),
      today: localToday(),
    });
    const properties = timelineTicketProperties(plan);
    // The timeline uses workspace identities, not the board's live session badges.
    const toRow = createTicketRowMapper(
      ctx.projectId,
      tags,
      createTicketWorkspaceLookup(workspaces),
      createTicketParentLookup(tickets),
    );
    const ticketRows = active.map((ticket) => {
      const row = toRow(ticket);
      return {
        ...row,
        resource: { ...row.resource, extensionId: ctx.extensionId },
        attributes: { ...row.attributes, ...properties.values.get(ticket.id) },
      };
    });
    const resources = new Map(ticketRows.map(({ id, resource }) => [id, resource]));
    return {
      ...plan,
      // Ordinary documents open on the ticket page; only gates display instructions in the canvas.
      sections: plan.sections.map((section) => ({
        ...section,
        rows: section.rows.map((row) => ({
          ...row,
          instructions: row.gate ? row.instructions : "",
          target: ticketActivationTarget(
            resources.get(row.id)!,
            hasPendingInput({ requests: row.requests, errors: row.requestErrors }),
          ),
        })),
      })),
      projectId: ctx.projectId,
      savedViews: await ctx.views.list(timelineBoard),
      ticketRows,
      ticketAttributes: [...buildTicketAttributes(statuses, tags), ...properties.attributes],
    };
  },
});
