import type { HarnessContext } from "@pstdio/sdk/extensions";

interface TurnCursor {
  workspaceId: string;
  afterMessageId: number;
}
const key = (sessionId: string) => `turn:${sessionId}`;

export const saveTurnCursor = (ctx: HarnessContext, sessionId: string, workspaceId: string, afterMessageId: number) =>
  ctx.state.set(key(sessionId), { workspaceId, afterMessageId } satisfies TurnCursor);

export const readTurnCursor = async (ctx: HarnessContext, sessionId: string, workspaceId: string) => {
  const cursor = await ctx.state.get<TurnCursor>(key(sessionId));
  if (!cursor || cursor.workspaceId !== workspaceId)
    throw new Error("No pending turn was found for this PocketCoder workspace.");
  return cursor.afterMessageId;
};

export const clearTurnCursor = (ctx: HarnessContext, sessionId: string) => ctx.state.delete(key(sessionId));
