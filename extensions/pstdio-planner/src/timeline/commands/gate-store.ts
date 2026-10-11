// Mark ticket-owned agent reviews; their instructions and workflow belong to Planner.
import type { CommandContext, ExtensionContextBase } from "@pstdio/sdk/extensions";
import { planChanged } from "../contracts";

type GateContext = Pick<ExtensionContextBase, "storage">;
export const gates = (ctx: GateContext) => ctx.storage.collection<{ ticketId: string }>("timeline.agent-gates");
export const readGates = async (ctx: GateContext) => new Set((await gates(ctx).list()).map(({ ticketId }) => ticketId));

export async function registerGate(ctx: CommandContext, ticketId: string) {
  await gates(ctx).createIfAbsent(ticketId, { ticketId });
  await ctx.events.emit(planChanged, { reason: "gate-created" });
}
