import { defineCommand } from "@pstdio/sdk/extensions";
import { createPlacedTicket, timelineTicketParams } from "./create-ticket";
import { registerGate } from "./gate-store";
import { GateLaunchUnconfirmed, launchGateCommand } from "./launch-gate";
export const createGateCommand = defineCommand({
  id: "timeline.gate.create",
  title: "Create agent gate",
  cli: { description: "Create a ticket with review instructions and launch an agent review." },
  mutating: true,
  params: timelineTicketParams,
  async run(ctx, input) {
    if (!input.content.trim()) throw new Error("An agent gate needs review instructions.");
    const result = await createPlacedTicket(ctx, input);
    let launchError: string | null = null;
    let launchStatus: "refused" | "unconfirmed" | null = null;
    try {
      await registerGate(ctx, result.ticket.id);
      if (!result.placementError) {
        await launchGateCommand.run(ctx, { ticket: result.ticket.id });
      }
    } catch (reason) {
      launchError = String(reason);
      launchStatus = reason instanceof GateLaunchUnconfirmed ? "unconfirmed" : "refused";
    }
    return { ...result, launchError, launchStatus };
  },
});
