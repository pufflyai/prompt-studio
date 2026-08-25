import { defineCommand, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { findTicket, resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import type { StoredTicket } from "../data/types";
import { notifyBlocked, resolveBlockedNotification } from "../planner-notifications";
import { deriveTitle } from "../utils/derive-title";

// Powers the markdown editor's save-on-edit autosave and the `pst tickets update`
// CLI path. The board passes ids; the CLI passes human names/shorthands, so the
// status, tags, and parent inputs are resolved server-side (Decision 3). The
// ticket title is the start of the body, so a content save re-derives it.
export const updateTicketCommand = defineCommand({
  title: "Update ticket",
  cli: {
    globalAliases: [["tickets", "update"]],
    examples: ["pstdio tickets update --id PS-1 --status 'In Progress' --tags High --tags Bug"],
  },
  params: {
    id: params.text({ required: true }),
    content: params.longText(),
    statusId: params.text(),
    status: params.text(),
    tagIds: params.json<string[]>(),
    tags: params.list(),
    parent: params.text(),
    unlinkParent: params.boolean(),
    blockedReason: params.text(),
  },
  async run(ctx, commandParams) {
    const collection = ticketsCollection(ctx.storage);
    const existing = await findTicket(ctx.storage, commandParams.id);
    if (!existing) throw new Error(`Unknown ticket "${commandParams.id}"`);

    const statusId =
      commandParams.status !== undefined
        ? await resolveStatusId(ctx.storage, commandParams.status)
        : commandParams.statusId;
    const tagIds =
      commandParams.tags !== undefined
        ? await resolveTagOptionIds(ctx.storage, commandParams.tags)
        : commandParams.tagIds;
    const parentId = await resolveParentUpdate(ctx.storage, commandParams.parent, commandParams.unlinkParent);

    const next = {
      ...existing,
      ...(commandParams.content !== undefined
        ? { content: commandParams.content, title: deriveTitle(commandParams.content) }
        : {}),
      ...(statusId !== undefined ? { statusId: statusId || null } : {}),
      ...(tagIds !== undefined ? { tagIds } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
      ...(commandParams.blockedReason !== undefined ? { blockedReason: commandParams.blockedReason || null } : {}),
      updatedAt: new Date().toISOString(),
    };
    await collection.put(existing.id, next);
    await syncBlockedNotificationSafely(ctx, existing, next);
    return next;
  },
});

const isBlockedTicket = async (storage: ExtensionStorageApi, ticket: StoredTicket) => {
  if (ticket.blockedReason) return true;
  const status = ticket.statusId ? await statusesCollection(storage).get(ticket.statusId) : null;
  return status?.name.trim().toLowerCase() === "blocked";
};

const syncBlockedNotification = async (
  ctx: Parameters<typeof updateTicketCommand.run>[0],
  previous: StoredTicket,
  next: StoredTicket,
) => {
  const [wasBlocked, isBlocked] = await Promise.all([
    isBlockedTicket(ctx.storage, previous),
    isBlockedTicket(ctx.storage, next),
  ]);
  if (isBlocked) {
    await notifyBlocked(ctx, next);
    return;
  }
  if (wasBlocked) await resolveBlockedNotification(ctx, next);
};

// The ticket has already been persisted before this runs, so both the
// notification sync AND the warning toast must be best-effort: any failure
// inside this helper must not surface as a failed ticket update to callers
// (autosave, CLI). Swallow toast failures too, even if delivery is unavailable.
const syncBlockedNotificationSafely = async (
  ctx: Parameters<typeof updateTicketCommand.run>[0],
  previous: StoredTicket,
  next: StoredTicket,
) => {
  try {
    await syncBlockedNotification(ctx, previous, next);
  } catch (error) {
    try {
      await ctx.notify.toast({
        type: "warning",
        title: "Ticket saved",
        message: `Notification sync failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    } catch {
      // Best-effort: the ticket save already succeeded.
    }
  }
};

// undefined → leave the parent untouched; null → unlink; string → resolve the shorthand.
const resolveParentUpdate = async (
  storage: ExtensionStorageApi,
  parent: string | undefined,
  unlink: boolean | undefined,
) => {
  if (unlink) return null;
  if (parent !== undefined) return resolveTicketId(storage, parent);
  return undefined;
};
