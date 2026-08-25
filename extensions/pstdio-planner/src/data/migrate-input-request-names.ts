import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ATTEMPT_EVENTS_COLLECTION, ATTEMPT_SELECTIONS_COLLECTION, INPUT_REQUESTS_COLLECTION } from "./attempt-storage";
import { TAGS_COLLECTION, TICKETS_COLLECTION } from "./collections";
import type { StoredTag, StoredTagOption, StoredTicket } from "./types";

const currentIds = {
  tagId: "default-awaiting-input",
  optionId: "default-awaiting-input-true",
  optionName: "Awaiting Input",
  requestsCollection: INPUT_REQUESTS_COLLECTION,
  selectionField: "inputRequestId",
} as const;

// Old identifiers stay here so active commands and data types use one vocabulary.
export const inputRequestNameMigrationLegacyIds = {
  tagId: "default-human-requested",
  optionId: "default-human-requested-true",
  optionName: "Human Requested",
  requestsCollection: "planner-human-requests",
  selectionField: "humanRequestId",
  tagsCollection: TAGS_COLLECTION,
  ticketsCollection: TICKETS_COLLECTION,
  selectionsCollection: ATTEMPT_SELECTIONS_COLLECTION,
  eventsCollection: ATTEMPT_EVENTS_COLLECTION,
} as const;

const currentOption = (source?: StoredTagOption): StoredTagOption => ({
  id: currentIds.optionId,
  name: currentIds.optionName,
  color: "orange",
  sortOrder: source?.sortOrder ?? 0,
  icon: "bell",
  description: source?.description ?? null,
});

const toCurrentTag = (source?: StoredTag, existing?: StoredTag): StoredTag => {
  const base = existing ?? source;
  const sourceOption = source?.options.find((option) => option.id === inputRequestNameMigrationLegacyIds.optionId);
  const remainingOptions = new Map(
    [...(source?.options ?? []), ...(existing?.options ?? [])]
      .filter(
        (option) => option.id !== inputRequestNameMigrationLegacyIds.optionId && option.id !== currentIds.optionId,
      )
      .map((option) => [option.id, option]),
  );

  return {
    id: currentIds.tagId,
    name: base?.name ?? "Flags",
    type: base?.type ?? "multi_select",
    sortOrder: base?.sortOrder ?? 3,
    options: [...remainingOptions.values(), currentOption(sourceOption)].sort((a, b) => a.sortOrder - b.sortOrder),
  };
};

const migrateTag = async (storage: ExtensionStorageApi) => {
  const tags = storage.collection<StoredTag>(TAGS_COLLECTION);
  const [legacyTag, currentTag] = await Promise.all([
    tags.get(inputRequestNameMigrationLegacyIds.tagId),
    tags.get(currentIds.tagId),
  ]);
  if (!legacyTag && !currentTag) return;

  await tags.put(currentIds.tagId, toCurrentTag(legacyTag, currentTag));
};

const migrateTicketSelections = async (storage: ExtensionStorageApi) => {
  const tickets = storage.collection<StoredTicket>(TICKETS_COLLECTION);
  for (const ticket of await tickets.list()) {
    if (!(ticket.tagIds ?? []).includes(inputRequestNameMigrationLegacyIds.optionId)) continue;
    const tagIds = (ticket.tagIds ?? []).map((id) =>
      id === inputRequestNameMigrationLegacyIds.optionId ? currentIds.optionId : id,
    );
    await tickets.put(ticket.id, { ...ticket, tagIds: [...new Set(tagIds)] });
  }
};

const migrateRequestRecords = async (storage: ExtensionStorageApi) => {
  const legacyRequests = storage.collection<Record<string, unknown>>(
    inputRequestNameMigrationLegacyIds.requestsCollection,
  );
  const currentRequests = storage.collection<Record<string, unknown>>(currentIds.requestsCollection);
  const records = await legacyRequests.list();

  for (const record of records) {
    if (typeof record.id !== "string") continue;
    await currentRequests.createIfAbsent(record.id, record);
  }
};

const renameRecordField = (record: Record<string, unknown>) => {
  const { [inputRequestNameMigrationLegacyIds.selectionField]: legacyValue, ...remaining } = record;
  if (legacyValue === undefined || currentIds.selectionField in remaining) return remaining;
  return { ...remaining, [currentIds.selectionField]: legacyValue };
};

const migrateAttemptReferences = async (storage: ExtensionStorageApi) => {
  const selections = storage.collection<Record<string, unknown>>(ATTEMPT_SELECTIONS_COLLECTION);
  for (const selection of await selections.list()) {
    if (typeof selection.ticketId !== "string" || !(inputRequestNameMigrationLegacyIds.selectionField in selection)) {
      continue;
    }
    await selections.put(selection.ticketId, renameRecordField(selection));
  }

  const events = storage.collection<Record<string, unknown>>(ATTEMPT_EVENTS_COLLECTION);
  for (const event of await events.list()) {
    if (typeof event.id !== "string" || typeof event.metadata !== "object" || event.metadata === null) continue;
    const metadata = event.metadata as Record<string, unknown>;
    if (!(inputRequestNameMigrationLegacyIds.selectionField in metadata)) continue;
    await events.put(event.id, { ...event, metadata: renameRecordField(metadata) });
  }
};

const deleteLegacyData = async (storage: ExtensionStorageApi) => {
  const legacyRequests = storage.collection<Record<string, unknown>>(
    inputRequestNameMigrationLegacyIds.requestsCollection,
  );
  for (const record of await legacyRequests.list()) {
    if (typeof record.id === "string") await legacyRequests.delete(record.id);
  }
  await storage.collection<StoredTag>(TAGS_COLLECTION).delete(inputRequestNameMigrationLegacyIds.tagId);
};

export const migrateInputRequestNames = async (storage: ExtensionStorageApi) => {
  await migrateTag(storage);
  await migrateTicketSelections(storage);
  await migrateRequestRecords(storage);
  await migrateAttemptReferences(storage);
  await deleteLegacyData(storage);
};
