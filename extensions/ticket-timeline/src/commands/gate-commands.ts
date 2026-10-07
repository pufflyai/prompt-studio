// Create a free-form review gate and launch its agent after successful plan placement.
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { planChanged } from "../contracts";
import { createPlacedTicket } from "./create-ticket";
import { gates } from "./gate-store";
import { launchGateCommand } from "./launch-gate";

export const createGateCommand = defineCommand({
  id: "gate.create",
  title: "Create agent gate",
  cli: { description: "Create a gate with free-form instructions and launch an agent review." },
  mutating: true,
  params: {
    title: params.text({ required: true }),
    instructions: params.longText({ required: true }),
    track: params.text(),
    deadline: params.text(),
    dependsOn: params.list(),
  },
  async run(ctx, input) {
    const title = input.title.trim();
    const instructions = input.instructions.trim();
    if (!title || !instructions) {
      throw new Error("An agent gate needs a title and instructions.");
    }
    const result = await createPlacedTicket(ctx, {
      title,
      content: `# ${title}\n\n${instructions}`,
      track: input.track,
      deadline: input.deadline,
      dependsOn: input.dependsOn,
    });
    await gates(ctx).createIfAbsent(result.ticket.id, { ticketId: result.ticket.id });
    await ctx.events.emit(planChanged, { reason: "gate-created" });
    let launchError: string | null = null;
    if (!result.placementError) {
      try {
        await launchGateCommand.run(ctx, { ticket: result.ticket.id });
      } catch (reason) {
        launchError = String(reason);
      }
    }
    return { ...result, launchError };
  },
});
