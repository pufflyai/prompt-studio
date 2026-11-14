import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { withWriteGuard } from "./write-guard";

const busy = Symbol("busy");
const ORDER_WAIT_MS = 5_000;
const ORDER_RETRY_MS = 25;

/**
 * Serializes ticket creation with other order writers. Board moves fail fast and
 * the board shows the error, but a create must not fail because a move or another
 * create holds the order for a moment. A live writer retains ownership after the wait.
 */
export const withTicketOrder = async <T>(
  ctx: Pick<ExtensionContextBase, "storage" | "projectId" | "extensionId" | "resources" | "files">,
  write: () => Promise<T>,
) => {
  const deadline = Date.now() + ORDER_WAIT_MS;
  for (;;) {
    const result = await withWriteGuard<T | typeof busy>(ctx, "ticket-order", write, () => busy);
    if (result !== busy) return result;
    if (Date.now() >= deadline) return withWriteGuard(ctx, "ticket-order", write);
    await new Promise((resolve) => setTimeout(resolve, ORDER_RETRY_MS));
  }
};
