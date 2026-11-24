import { setImmediate } from "node:timers/promises";
import type { CommandContext } from "@pstdio/sdk/extensions";

export const readTicketPage = async <T extends { revision: string }>(
  ctx: Pick<CommandContext, "storage" | "signal">,
  cursor: string | undefined,
  read: () => Promise<T>,
) => {
  while (true) {
    ctx.signal.throwIfAborted();
    try {
      const page = await read();
      ctx.signal.throwIfAborted();
      await ctx.storage.records.query({
        index: "ticket-view",
        fields: [],
        limit: 1,
        orderBy: [],
        revision: page.revision,
      });
      ctx.signal.throwIfAborted();
      return page;
    } catch (error) {
      ctx.signal.throwIfAborted();
      if (cursor || !(error instanceof Error) || error.message !== "Query revision is stale; restart the query")
        throw error;
      // Sync can invalidate successive first-page reads. Yield to writes and cancellation;
      // continuations must keep their original revision instead of restarting.
      await setImmediate(undefined, { signal: ctx.signal });
    }
  }
};
