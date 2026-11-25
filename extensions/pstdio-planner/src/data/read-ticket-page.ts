import { setImmediate } from "node:timers/promises";
import type { CommandContext } from "@pstdio/sdk/extensions";

const staleRevision = (error: unknown) =>
  error instanceof Error &&
  (error.message === "Query revision is stale; restart the query" ||
    error.message === "Collection query revision is stale; restart the query");

export const readStableTicketPage = async <T>(pinned: boolean, read: () => Promise<T>, signal?: AbortSignal) => {
  let canRestart = !pinned;
  while (true) {
    signal?.throwIfAborted();
    try {
      const page = await read();
      signal?.throwIfAborted();
      return page;
    } catch (error) {
      signal?.throwIfAborted();
      if (!canRestart || !staleRevision(error)) throw error;
      // Renderers use cancellation-scoped storage reads. Without a command signal, restart once.
      canRestart = signal !== undefined;
      // Sync can invalidate successive reads. Yield to writes and cancellation before starting fresh.
      await setImmediate(undefined, { signal });
    }
  }
};

export const readTicketPage = <T extends { revision: string }>(
  ctx: Pick<CommandContext, "storage" | "signal">,
  cursor: string | undefined,
  read: () => Promise<T>,
) =>
  readStableTicketPage(
    Boolean(cursor),
    async () => {
      const page = await read();
      ctx.signal.throwIfAborted();
      await ctx.storage.records.query({
        index: "ticket-view",
        fields: [],
        limit: 1,
        orderBy: [],
        revision: page.revision,
      });
      return page;
    },
    ctx.signal,
  );
