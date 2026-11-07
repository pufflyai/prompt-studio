import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const readQueue = async (ctx: ExtensionContextBase, id: string) => {
  try {
    return { ...(await ctx.sessions.getQueuedMessages(id)), error: undefined as string | undefined };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { messages: [], queue: undefined, error: error instanceof Error ? error.message : String(error) };
  }
};
