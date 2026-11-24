// Mark ticket-owned agent reviews; their instructions and workflow belong to Planner.
import type { CommandContext, ExtensionContextBase } from "@pstdio/sdk/extensions";
import { planChanged } from "../contracts";

type GateContext = Pick<ExtensionContextBase, "storage" | "resources">;
export const gates = (ctx: GateContext) => ctx.storage.collection<{ ticketId: string }>("timeline.agent-gates");
export const gateLaunches = (ctx: GateContext) =>
  ctx.storage.collection<{ launchId: string }>("timeline.agent-gate-launches");

export async function registerGate(ctx: CommandContext, ticketId: string) {
  await gates(ctx).createIfAbsent(ticketId, { ticketId });
  await ctx.events.emit(planChanged, { reason: "gate-created" });
}
