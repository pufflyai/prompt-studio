import { defineCommand, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket, resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
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
  async run(ctx) {
    const collection = ticketsCollection(ctx.storage);
    const existing = await findTicket(ctx.storage, ctx.params.id);
    if (!existing) throw new Error(`Unknown ticket "${ctx.params.id}"`);

    const statusId =
      ctx.params.status !== undefined ? await resolveStatusId(ctx.storage, ctx.params.status) : ctx.params.statusId;
    const tagIds =
      ctx.params.tags !== undefined ? await resolveTagOptionIds(ctx.storage, ctx.params.tags) : ctx.params.tagIds;
    const parentId = await resolveParentUpdate(ctx.storage, ctx.params.parent, ctx.params.unlinkParent);

    const next = {
      ...existing,
      ...(ctx.params.content !== undefined
        ? { content: ctx.params.content, title: deriveTitle(ctx.params.content) }
        : {}),
      ...(statusId !== undefined ? { statusId: statusId || null } : {}),
      ...(tagIds !== undefined ? { tagIds } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
      ...(ctx.params.blockedReason !== undefined ? { blockedReason: ctx.params.blockedReason || null } : {}),
      updatedAt: new Date().toISOString(),
    };
    await collection.put(existing.id, next);
    return next;
  },
});

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
