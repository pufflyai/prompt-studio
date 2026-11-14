import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { linkedWorkspacePages, workspaceTicketLinks } from "../data/linked-workspaces";
import { plannerOwnerFor } from "../data/ticket-resource-hierarchy";
import { inBatches, ticketSelectionPage } from "../data/ticket-selection";

export type TicketCleanupContext = Pick<
  ExtensionContextBase,
  "storage" | "settings" | "workspaces" | "notify" | "resources"
> & { extensionId?: string; projectId?: string };

const workspaceHasActiveTickets = async (ctx: TicketCleanupContext, workspaceId: string) => {
  const ids: string[] = [];
  const active = async () =>
    (
      await ticketSelectionPage(ctx.storage, {
        limit: 1,
        where: {
          all: [
            { field: "id", op: "in", value: ids },
            { field: "archived", op: "ne", value: true },
          ],
        },
      })
    ).records.length > 0;
  for await (const ref of workspaceTicketLinks(ctx, workspaceId)) {
    if (
      (ref.extensionId && ref.extensionId !== plannerOwnerFor(ctx)) ||
      (ctx.projectId && ref.projectId && ref.projectId !== ctx.projectId)
    )
      return true;
    ids.push(ref.id);
    if (ids.length === 100) {
      if (await active()) return true;
      ids.length = 0;
    }
  }
  return ids.length > 0 && (await active());
};

export const deleteUnusedLinkedWorkspaces = async (ctx: TicketCleanupContext, tickets: { id: string }[]) => {
  try {
    if ((await ctx.settings.get("tickets.deleteLinkedWorkspaces")) === false) return;
    const failures: unknown[] = [];
    let failureCount = 0;
    for await (const workspaces of linkedWorkspacePages(ctx, tickets)) {
      await inBatches(workspaces, async (workspace) => {
        if (
          workspace.is_default ||
          workspace.isDefault ||
          workspace.capabilities?.delete === false ||
          workspace.provider_capabilities_json?.delete === false
        )
          return;
        if (!(await workspaceHasActiveTickets(ctx, workspace.id)))
          await ctx.workspaces.delete(workspace.id).catch((error) => {
            failureCount++;
            if (failures.length < 20) failures.push(error);
          });
      });
    }
    if (failureCount) throw new AggregateError(failures, `${failureCount} workspace deletions failed`);
  } catch (error) {
    // The ticket change has already persisted. Notify even when the column action returned.
    const errors = error instanceof AggregateError ? error.errors : [error];
    try {
      await ctx.notify.action({
        title: "Workspace cleanup failed",
        body: `Linked workspace cleanup failed after changing the ticket: ${error instanceof AggregateError ? `${error.message}. ` : ""}${errors.map((item) => (item instanceof Error ? item.message : String(item))).join("; ")}`,
        kind: "failed",
        priority: "normal",
      });
    } catch {
      // A notification failure must not undo the ticket change.
    }
  }
};

export const cleanupTicketWorkspacesCommand = defineCommand({
  id: "cleanup-ticket-workspaces",
  title: "Clean up archived ticket workspaces",
  mutating: true,
  automation: true,
  params: { ticketIds: params.json<string[]>() },
  async run(ctx, { ticketIds }) {
    if (!Array.isArray(ticketIds) || ticketIds.length > 100 || ticketIds.some((id) => typeof id !== "string"))
      throw new Error("Clean up at most 100 tickets per job");
    const page = await ticketSelectionPage(ctx.storage, {
      limit: 100,
      where: {
        all: [
          { field: "id", op: "in", value: ticketIds },
          { field: "archived", op: "eq", value: true },
        ],
      },
    });
    const tickets = page.records.map(({ fields }) => ({ id: String(fields.id) }));
    await deleteUnusedLinkedWorkspaces(ctx, tickets);
  },
});
