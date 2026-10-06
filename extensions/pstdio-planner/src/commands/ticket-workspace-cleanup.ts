import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import type { StoredTicket } from "../data/types";
import { isWorkspaceLinkedToTicket } from "../data/workspace-ticket-link";

export type TicketCleanupContext = Pick<ExtensionContextBase, "storage" | "settings" | "workspaces" | "notify">;

export const deleteUnusedLinkedWorkspaces = async (ctx: TicketCleanupContext, tickets: StoredTicket[]) => {
  try {
    if ((await ctx.settings.get("tickets.deleteLinkedWorkspaces")) === false) return;
    const activeIds = new Set(
      (await ticketsCollection(ctx.storage).list()).filter((ticket) => !ticket.archived).map((ticket) => ticket.id),
    );
    const unused = (await ctx.workspaces.list()).filter(
      (workspace) =>
        !workspace.is_default &&
        workspace.provider_capabilities_json?.delete !== false &&
        tickets.some(
          (ticket) =>
            (workspace.anchors_json ?? []).some((anchor) => anchor.type === "ticket" && anchor.id === ticket.id) ||
            isWorkspaceLinkedToTicket(workspace, ticket.shorthand),
        ) &&
        (workspace.anchors_json ?? [])
          .filter((anchor) => anchor.type === "ticket")
          .every((anchor) => !activeIds.has(anchor.id)),
    );
    const results = await Promise.allSettled(unused.map((workspace) => ctx.workspaces.delete(workspace.id)));
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length)
      throw new AggregateError(
        failures.map((result) => result.reason),
        "Workspace deletion failed",
      );
  } catch (error) {
    // The ticket change has already persisted. Notify even when the column action returned.
    const errors = error instanceof AggregateError ? error.errors : [error];
    try {
      await ctx.notify.action({
        title: "Workspace cleanup failed",
        body: `Linked workspace cleanup failed after changing the ticket: ${errors.map((item) => (item instanceof Error ? item.message : String(item))).join("; ")}`,
        kind: "failed",
        priority: "normal",
      });
    } catch {
      // A notification failure must not undo the ticket change.
    }
  }
};
