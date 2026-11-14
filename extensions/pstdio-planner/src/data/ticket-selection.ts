import { readCollectionRecords } from "@pstdio/sdk/data";
import type { ExtensionStorageApi, StoragePredicate, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";
import { readTicketTags, type StoredTicketRecord } from "./ticket-tag-storage";

const fields: StorageRecordIndex["fields"] = {
  id: { path: ["id"], type: "string" },
  statusId: { path: ["statusId"], type: "string" },
  archived: { path: ["archived"], type: "boolean" },
  draft: { path: ["draft"], type: "boolean" },
  parentId: { path: ["parentId"], type: "string" },
  position: { path: ["position"], type: "string" },
  sortOrder: { path: ["sortOrder"], type: "number" },
  blockedReason: { path: ["blockedReason"], type: "string" },
  createdAt: { path: ["createdAt"], type: "string" },
  parallelizable: { path: ["parallelizable"], type: "boolean" },
  parallelizableText: { path: ["parallelizable"], type: "string" },
};

export const missingTicketPosition: StoragePredicate = { field: "position", op: "in", value: [null, ""] };

export const ticketSelectionIndexes: StorageRecordIndex[] = [
  {
    name: "ticket-tags",
    collection: "tickets",
    fields: {
      ...fields,
      tags: { path: ["tags"], type: "object" },
      selections: { path: ["tagSelections"], type: "object" },
    },
    orderBy: [{ field: "id", direction: "asc" }],
  },
  { name: "ticket-records", collection: "tickets", fields, orderBy: [{ field: "id", direction: "asc" }] },
  {
    name: "ticket-status",
    collection: "tickets",
    fields,
    equality: ["statusId", "archived"],
    orderBy: [{ field: "id", direction: "asc" }],
  },
  {
    name: "ticket-missing-position",
    collection: "tickets",
    fields,
    equality: ["position"],
    orderBy: [{ field: "id", direction: "asc" }],
  },
  {
    name: "ticket-active-order",
    collection: "tickets",
    fields,
    equality: ["archived"],
    orderBy: [
      { field: "position", direction: "desc" },
      { field: "id", direction: "desc" },
    ],
  },
  ...(["asc", "desc"] as const).map((direction) => ({
    name: `ticket-order-${direction}`,
    collection: "tickets",
    fields,
    orderBy: [
      { field: "position", direction },
      { field: "id", direction },
    ],
  })),
  {
    name: "ticket-legacy-order",
    collection: "tickets",
    fields,
    orderBy: [
      { field: "sortOrder", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
  },
];

export const ticketTagSelection = (tagId: string): StoragePredicate => ({
  any: [
    { field: "tags", op: "hasKey", value: tagId },
    { field: "selections", op: "hasKey", value: tagId },
  ],
});

export const ticketSelectionPage = async (
  storage: ExtensionStorageApi,
  input: {
    where?: StoragePredicate;
    after?: string;
    limit?: number;
    index?: string;
    cursor?: string;
    offset?: number;
    revision?: string;
  } = {},
) => {
  await preparePlannerIndexes(storage);
  const { after, where, index = "ticket-records", limit = 100, ...position } = input;
  return storage.records.query({
    index,
    limit,
    fields: ["id", "position", "sortOrder"],
    ...position,
    where: after ? { all: [...(where ? [where] : []), { field: "id", op: "gt", value: after }] } : where,
  });
};

/** A stable ID boundary survives writes; revision-bound read cursors do not. */
export async function* ticketRecordPages(
  storage: ExtensionStorageApi,
  where?: StoragePredicate,
  index = "ticket-records",
) {
  let after: string | undefined;
  for (;;) {
    const page = await ticketSelectionPage(storage, { where, index, after });
    if (!page.records.length) return;
    const rows = await readCollectionRecords<StoredTicketRecord>(
      storage,
      page.records.map(({ recordId }) => recordId),
    );
    yield rows.flatMap((row) => (row ? [readTicketTags(row)] : []));
    after = String(page.records.at(-1)!.fields.id);
    if (page.records.length < 100) return;
  }
}

export const inBatches = async <T>(rows: T[], write: (row: T) => Promise<unknown>) => {
  for (let offset = 0; offset < rows.length; offset += 8) await Promise.all(rows.slice(offset, offset + 8).map(write));
};

/** Keyset pages remain valid while a migration changes other fields. */
export async function* ticketKeyPages(
  storage: ExtensionStorageApi,
  where?: StoragePredicate,
  index = "ticket-records",
  orderedField?: "sortOrder",
) {
  let boundary: StoragePredicate | undefined;
  for (;;) {
    const page = await ticketSelectionPage(storage, {
      index,
      where: boundary ? { all: [...(where ? [where] : []), boundary] } : where,
    });
    if (!page.records.length) return;
    yield page.records;
    const last = page.records.at(-1)!.fields;
    const id: StoragePredicate = { field: "id", op: "gt", value: last.id };
    boundary = orderedField
      ? {
          any: [
            { field: orderedField, op: "gt", value: last[orderedField] },
            { all: [{ field: orderedField, op: "eq", value: last[orderedField] }, id] },
          ],
        }
      : id;
    if (page.records.length < 100) return;
  }
}
