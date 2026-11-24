// Mark ticket-owned agent reviews; their instructions and workflow belong to Planner.
import type { CommandContext, ExtensionContextBase } from "@pstdio/sdk/extensions";
import { planChanged } from "../contracts";

type GateContext = Pick<ExtensionContextBase, "storage" | "resources">;
type GateLaunch = { launchId: string };
export const gates = (ctx: GateContext) => ctx.storage.collection<{ ticketId: string }>("timeline.agent-gates");
export const gateLaunches = (ctx: GateContext) => ctx.storage.collection<GateLaunch>("timeline.agent-gate-launches");

export async function releaseRefusedGateLaunch(
  ctx: GateContext,
  ticketId: string,
  refused: GateLaunch,
  previous?: GateLaunch,
) {
  const launches = gateLaunches(ctx);
  if (!previous) return launches.deleteIfValue(ticketId, refused);
  const current = await launches.read(ticketId);
  if (current?.value.launchId !== refused.launchId) return false;
  return launches.updateIfUnchanged(ticketId, current.revision, previous);
}

export async function registerGate(ctx: CommandContext, ticketId: string) {
  await gates(ctx).createIfAbsent(ticketId, { ticketId });
  await ctx.events.emit(planChanged, { reason: "gate-created" });
}
