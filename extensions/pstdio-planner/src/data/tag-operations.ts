import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { bySortOrder } from "../utils/sort";
import { putTag, putTicket, tagsCollection, ticketsCollection } from "./collections";
import { seedDefaultTags } from "./seed";
import {
  assertSingleSelectConversion,
  convertTicketTagValues,
  editTicketTagValues,
  ticketTagsForIds,
} from "./tag-cardinality";
import type { TicketContext } from "./ticket-identity";
import { tagValue, tagValueIds } from "./ticket-tags";
import type { StoredTag, StoredTagOption } from "./types";

const sortTag = (tag: StoredTag): StoredTag => ({ ...tag, options: [...tag.options].sort(bySortOrder) });

export const readTicketTags = async (storage: ExtensionStorageApi) => ({
  tags: (await seedDefaultTags(storage)).sort(bySortOrder).map(sortTag),
});

const requireTag = async (storage: ExtensionStorageApi, tagId: string) => {
  const tag = await tagsCollection(storage).get(tagId);
  if (!tag) throw new Error(`Unknown ticket tag: ${tagId}`);
  return tag;
};

export const createTicketTag = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  name: string;
  type?: StoredTag["type"];
}) => {
  const tags = await seedDefaultTags(input.storage);
  const sortOrder = Math.max(-1, ...tags.map((tag) => tag.sortOrder)) + 1;
  return putTag(input.storage, {
    id: crypto.randomUUID(),
    name: input.name,
    type: input.type ?? "single_select",
    sortOrder,
    options: [],
  });
};

export const updateTicketTag = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  tagId: string;
  name?: string;
  type?: StoredTag["type"];
  sortOrder?: number;
}) => {
  const tag = await requireTag(input.storage, input.tagId);
  await assertSingleSelectConversion(input, tag, input.type);
  const next = await putTag(input.storage, {
    ...tag,
    name: input.name ?? tag.name,
    type: input.type ?? tag.type,
    sortOrder: input.sortOrder ?? tag.sortOrder,
  });
  if (next.type !== tag.type) await convertTicketTagValues(input.storage, next);
  return next;
};

// Removes deleted options from every ticket's value for this tag.
const removeTicketTagOptions = (storage: ExtensionStorageApi, tag: StoredTag, optionIds: Set<string>) =>
  editTicketTagValues(storage, tag.id, (value) =>
    tagValue(
      tag,
      tagValueIds(value).filter((id) => !optionIds.has(id)),
      value,
    ),
  );

// Removing a tag also removes its value from every ticket so no ticket points
// at a tag that no longer exists.
export const deleteTicketTag = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  tagId: string;
}) => {
  await editTicketTagValues(input.storage, input.tagId, () => undefined);

  await tagsCollection(input.storage).delete(input.tagId);
  return { tagId: input.tagId };
};

export const createTagOption = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  tagId: string;
  name: string;
  color?: string;
  icon?: string | null;
  description?: string | null;
}) => {
  const tag = await requireTag(input.storage, input.tagId);
  const sortOrder = Math.max(-1, ...tag.options.map((opt) => opt.sortOrder)) + 1;
  const created: StoredTagOption = {
    id: crypto.randomUUID(),
    name: input.name,
    color: input.color ?? "gray",
    sortOrder,
    icon: input.icon ?? null,
    description: input.description ?? null,
  };
  await putTag(input.storage, { ...tag, options: [...tag.options, created] });
  return created;
};

export const updateTagOption = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  tagId: string;
  optionId: string;
  name?: string;
  color?: string;
  sortOrder?: number;
  icon?: string | null;
  description?: string | null;
}) => {
  const tag = await requireTag(input.storage, input.tagId);
  const options = tag.options.map((opt) =>
    opt.id === input.optionId
      ? {
          ...opt,
          name: input.name ?? opt.name,
          color: input.color ?? opt.color,
          sortOrder: input.sortOrder ?? opt.sortOrder,
          icon: input.icon ?? opt.icon,
          description: input.description ?? opt.description,
        }
      : opt,
  );
  return putTag(input.storage, { ...tag, options });
};

export const deleteTagOption = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  tagId: string;
  optionId: string;
}) => {
  const tag = await requireTag(input.storage, input.tagId);
  await putTag(input.storage, { ...tag, options: tag.options.filter((opt) => opt.id !== input.optionId) });
  await removeTicketTagOptions(input.storage, tag, new Set([input.optionId]));

  return { tagId: input.tagId, optionId: input.optionId };
};

// Replaces a ticket's tag-option ids. The renderer/properties panel sends the full
// next set across all tags.
export const setTicketTags = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  ticketId: string;
  tagIds: string[];
}) => {
  const ticket = await ticketsCollection(input).get(input.ticketId);
  if (!ticket) return null;
  const tags = await ticketTagsForIds(input.storage, input.tagIds, ticket.tags);
  return putTicket(input, { ...ticket, tags, updatedAt: new Date().toISOString() });
};

export interface TagDraftOptionCreate {
  name: string;
  color?: string;
  icon?: string | null;
}

export interface TagDraftOptionUpdate {
  id: string;
  name?: string;
  color?: string;
  icon?: string | null;
}

// Applies a full tag draft (type + create/update/delete options) in a single tag
// write so partial-save failures from per-option commands are no longer possible.
// Ticket values of deleted options are removed after the tag write succeeds.
export const applyTagDraft = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  tagId: string;
  name?: string;
  type?: StoredTag["type"];
  optionsToCreate: TagDraftOptionCreate[];
  optionsToUpdate: TagDraftOptionUpdate[];
  optionIdsToDelete: string[];
}) => {
  const tag = await requireTag(input.storage, input.tagId);
  const updatesById = new Map(input.optionsToUpdate.map((entry) => [entry.id, entry]));
  const deletedIds = new Set(input.optionIdsToDelete);

  const kept = tag.options
    .filter((option) => !deletedIds.has(option.id))
    .map((option) => {
      const update = updatesById.get(option.id);
      if (!update) return option;
      return {
        ...option,
        name: update.name ?? option.name,
        color: update.color ?? option.color,
        icon: update.icon ?? option.icon,
      };
    });

  // Values of deleted options go away with them, so they cannot conflict.
  await assertSingleSelectConversion(input, { ...tag, options: kept }, input.type);
  const startingSortOrder = Math.max(-1, ...tag.options.map((option) => option.sortOrder)) + 1;
  const created: StoredTagOption[] = input.optionsToCreate.map((option, index) => ({
    id: crypto.randomUUID(),
    name: option.name,
    color: option.color ?? "gray",
    sortOrder: startingSortOrder + index,
    icon: option.icon ?? null,
    description: null,
  }));

  const next = await putTag(input.storage, {
    ...tag,
    name: input.name ?? tag.name,
    type: input.type ?? tag.type,
    options: [...kept, ...created],
  });

  if (deletedIds.size > 0) await removeTicketTagOptions(input.storage, next, deletedIds);
  if (next.type !== tag.type) await convertTicketTagValues(input.storage, next);

  return { tagId: input.tagId };
};
