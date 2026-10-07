// Create a Planner ticket once and report deadline placement separately for safe retries.
import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { moveTicket } from "../model/edit-plan";
import { resolvePlan } from "../model/resolve-plan";
import { callPlanner, type PlannerTicket, planner } from "../planner";
import { findDeadlineId, loadPlan, savePlan } from "./plan-store";
import { readTrack } from "./track-commands";
import { withWriteGuard } from "./write-guard";

export interface TicketInput {
  title: string;
  content: string;
  track?: string;
  deadline?: string;
  dependsOn?: string[];
}

// Placement can fail after creation; the created identity is returned so a retry only moves it.
export async function createPlacedTicket(ctx: CommandContext, input: TicketInput) {
  let created: PlannerTicket | undefined;
  try {
    return await withWriteGuard(ctx, "plan", async () => {
      const loaded = await loadPlan(ctx);
      const property = await readTrack(ctx);
      if (input.track && !property?.options.some(({ id }) => id === input.track)) {
        throw new Error("Unknown track.");
      }
      if (property) {
        await ctx.storage.set("track-property-id", property.id);
      }
      const deadlineId =
        input.deadline && input.deadline !== "none" ? findDeadlineId(loaded.plan, input.deadline) : null;
      const ticket = await callPlanner(ctx, planner.createTicket, {
        title: input.title,
        content: input.content,
        tagIds: input.track ? [input.track] : [],
        dependsOn: input.dependsOn ?? [],
      });
      created = ticket;
      try {
        const next = resolvePlan(loaded.plan, [...loaded.tickets, ticket]);
        await savePlan(ctx, moveTicket(next, { ticketId: ticket.id, deadlineId }), "ticket");
        return { ticket, placementError: null as string | null };
      } catch (reason) {
        return { ticket, placementError: String(reason) };
      }
    });
  } catch (reason) {
    if (created) {
      return { ticket: created, placementError: String(reason) };
    }
    throw reason;
  }
}

export const createTicketCommand = defineCommand({
  id: "ticket.create",
  title: "Create timeline ticket",
  cli: { description: "Create a ticket in a track and milestone." },
  mutating: true,
  params: {
    title: params.text({ required: true }),
    description: params.longText(),
    track: params.text(),
    deadline: params.text(),
    dependsOn: params.list(),
  },
  async run(ctx, { title, description, track, deadline, dependsOn }) {
    const label = title.trim();
    if (!label) {
      throw new Error("A ticket title is required.");
    }
    return createPlacedTicket(ctx, {
      title: label,
      content: `# ${label}\n\n${description ?? ""}`,
      track,
      deadline,
      dependsOn,
    });
  },
});
