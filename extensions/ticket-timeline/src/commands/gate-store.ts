// Mark ticket-owned agent reviews; their instructions and workflow belong to Planner.
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

type GateContext = Pick<ExtensionContextBase, "storage">;
export const gates = (ctx: GateContext) => ctx.storage.collection<{ ticketId: string }>("agent-gates");
export const readGates = async (ctx: GateContext) => new Set((await gates(ctx).list()).map(({ ticketId }) => ticketId));
