import { defineCommand, params } from "@pstdio/sdk/extensions";
import { statusesCollection, updateTicket } from "../data/collections";
import {
  findTicket,
  resolveDependencyIds,
  resolveLinkedTicketId,
  resolveStatusId,
  resolveTagOptionIds,
} from "../data/resolve";
import { ticketTagsForIds } from "../data/tag-cardinality";
import { normalizeTicketDependencies, validateTicketDependencies } from "../data/ticket-dependencies";
import type { TicketContext } from "../data/ticket-identity";
import { withTicketTagIds } from "../data/ticket-tags";
import type { Ticket } from "../data/types";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../data/workflow-statuses";
import { plannerTicketsChanged } from "../events";
import { notifyBlocked, resolveBlockedNotification } from "../planner-notifications";
import { deriveTitle } from "../utils/derive-title";

// Powers the markdown editor's save-on-edit autosave and the `pst tickets update`
// CLI path. The board passes ids; the CLI passes human names/shorthands, so the
// status, tags, parent, and dependency inputs are resolved server-side
// (Decision 3). The ticket title is the start of the body, so a content save
// re-derives it.
export const updateTicketCommand = defineCommand({
  id: "update-ticket",
  mutating: true,
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
    dependsOn: params.list(),
    clearDependsOn: params.boolean(),
    blockedReason: params.text(),
  },
  async run(ctx, commandParams) {
    const existing = await findTicket(ctx, commandParams.id);
    if (!existing) throw new Error(`Unknown ticket "${commandParams.id}"`);

    const statusId =
      commandParams.status !== undefined
        ? await resolveStatusId(ctx.storage, commandParams.status)
        : commandParams.statusId;
    const tagIds =
      commandParams.tags !== undefined
        ? await resolveTagOptionIds(ctx.storage, commandParams.tags)
        : commandParams.tagIds;
    const tags = tagIds === undefined ? undefined : await ticketTagsForIds(ctx.storage, tagIds, existing.tags);
    const parentId = await resolveParentUpdate(ctx, existing, commandParams.parent, commandParams.unlinkParent);
    const dependsOn = await resolveDependencyUpdate(
      ctx,
      existing,
      commandParams.dependsOn,
      commandParams.clearDependsOn,
    );
    if (dependsOn !== undefined) await validateTicketDependencies(ctx, existing, dependsOn);

    const draft = {
      ...existing,
      ...(commandParams.content !== undefined
        ? { content: commandParams.content, title: deriveTitle(commandParams.content) }
        : {}),
      ...(statusId !== undefined ? { statusId: statusId || null } : {}),
      ...(tags !== undefined ? { tags } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
      ...(dependsOn !== undefined ? { dependsOn } : {}),
      ...(commandParams.blockedReason !== undefined ? { blockedReason: commandParams.blockedReason || null } : {}),
      updatedAt: new Date().toISOString(),
    };
    const next = await updateTicket(ctx, draft);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: existing.id });
    await syncBlockedNotificationSafely(ctx, existing, next);
    return withTicketTagIds(next);
  },
});

const isBlockedTicket = async (
  ctx: Pick<Parameters<typeof updateTicketCommand.run>[0], "storage" | "settings">,
  ticket: Ticket,
) => {
  if (ticket.blockedReason) return true;
  const status = ticket.statusId ? await statusesCollection(ctx.storage).get(ticket.statusId) : null;
  return (
    status !== undefined &&
    status !== null &&
    usableWorkflowStatuses(await readWorkflowStatuses(ctx)).blockedStatusIds.includes(status.id)
  );
};

const syncBlockedNotification = async (
  ctx: Parameters<typeof updateTicketCommand.run>[0],
  previous: Ticket,
  next: Ticket,
) => {
  const [wasBlocked, isBlocked] = await Promise.all([isBlockedTicket(ctx, previous), isBlockedTicket(ctx, next)]);
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
  previous: Ticket,
  next: Ticket,
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
  ctx: TicketContext,
  existing: Ticket,
  parent: string | undefined,
  unlink: boolean | undefined,
) => {
  if (unlink) return null;
  if (parent !== undefined) return resolveLinkedTicketId(ctx, parent, existing.parentId ? [existing.parentId] : []);
  return undefined;
};

// A supplied list replaces the whole set, so "not supplied" must stay distinct
// from "supplied empty": undefined leaves dependencies untouched, and clearing
// takes its own flag rather than an empty list a routine update could produce.
const resolveDependencyUpdate = async (
  ctx: TicketContext,
  existing: Ticket,
  dependsOn: string[] | undefined,
  clear: boolean | undefined,
) => {
  if (clear) return [];
  if (dependsOn !== undefined)
    return resolveDependencyIds(ctx, dependsOn, normalizeTicketDependencies(existing.dependsOn));
  return undefined;
};
