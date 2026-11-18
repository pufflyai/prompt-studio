import { statusesCollection, tagsCollection } from "./collections";
import type { TicketContext } from "./ticket-identity";
import { tagValueIds } from "./ticket-tags";
import type { StoredTag, StoredTicket } from "./types";

const labels = {
  statusId: "Status",
  tags: "Tags",
  parentId: "Parent",
  dependsOn: "Dependencies",
  blockedReason: "Blocker",
  archived: "Archived",
  reviewLinks: "Review links",
} as const;
const plain = (value: unknown): string => {
  if (value === null || value === undefined) return "None";
  return typeof value === "string" ? value : JSON.stringify(value);
};
const valueIds = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value : [];
};
/** Retain the raw change and its display names as they existed when the change happened. */
export const publishTicketChanges = async (
  ctx: TicketContext,
  before: StoredTicket,
  after: StoredTicket,
  preservedTags: StoredTag[] = [],
) => {
  if (!ctx.activity || !ctx.projectId || !ctx.extensionId) return;
  const fields = (Object.keys(labels) as (keyof typeof labels)[]).filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
  if (!fields.length) return;
  const [statuses, storedTags] = await Promise.all([
    statusesCollection(ctx.storage).list(),
    tagsCollection(ctx.storage).list(),
  ]);
  const tags = [...preservedTags, ...storedTags.filter((tag) => !preservedTags.some((old) => old.id === tag.id))];
  const display = async (field: keyof typeof labels, ticket: StoredTicket) => {
    const value = ticket[field];
    if (field === "statusId") return statuses.find((status) => status.id === value)?.name ?? plain(value);
    if (field === "tags")
      return (
        Object.entries(ticket.tags ?? {})
          .flatMap(([id, value]) => {
            const tag = tags.find((tag) => tag.id === id);
            const names = tagValueIds(value).map((id) => tag?.options.find((option) => option.id === id)?.name ?? id);
            return names.length ? [`${tag?.name ?? id}: ${names.join(", ")}`] : [];
          })
          .join("; ") || "None"
      );
    if (field === "parentId" || field === "dependsOn") {
      const ids = valueIds(value);
      return (
        (
          await Promise.all(
            ids.map(async (id) => (await ctx.resources.identity({ kind: "ticket", id }))?.shorthand ?? id),
          )
        ).join(", ") || "None"
      );
    }
    return plain(value);
  };
  const changes = await Promise.all(
    fields.map(async (field) => ({
      field,
      label: labels[field],
      before: before[field] ?? null,
      after: after[field] ?? null,
      beforeLabel: await display(field, before),
      afterLabel: await display(field, after),
    })),
  );
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(changes)));
  const key = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  await ctx.activity.publish(
    { projectId: ctx.projectId, extensionId: ctx.extensionId, type: "ticket", id: after.id },
    {
      key: `ticket-change:${after.id}:${after.updatedAt}:${key}`,
      kind: "change",
      body: `${fields.map((field) => labels[field]).join(", ")} changed`,
      changes,
    },
  );
};
