import type {
  ExtensionStorageApi,
  StoragePredicate,
  StorageQueryRecord,
  StorageRecordQuery,
} from "@pstdio/sdk/extensions";

const unplaced: StoragePredicate = {
  all: [
    { field: "archived", op: "ne", value: true },
    { not: { exists: { index: "timeline-placements", on: [{ sourceField: "id", relatedField: "ticketId" }] } } },
  ],
};
const dependencies = (row: StorageQueryRecord) => (Array.isArray(row.fields.dependsOn) ? row.fields.dependsOn : []);

const orderedWindow = (rows: StorageQueryRecord[]) => {
  const pending = [...rows];
  const ids = new Set(rows.map(({ fields }) => fields.id));
  const ordered: StorageQueryRecord[] = [];
  while (pending.length) {
    const ready = pending.findIndex((row) => dependencies(row).every((id) => id === row.fields.id || !ids.has(id)));
    if (ready < 0) return undefined;
    const [row] = pending.splice(ready, 1);
    ids.delete(row.fields.id);
    ordered.push(row);
  }
  return ordered;
};

/** Complete independent windows locally; cross-window graphs retain the database's global first-ready order. */
export const nextPlacementBatch = async (storage: ExtensionStorageApi, completedStatusIds: string[]) => {
  const query: StorageRecordQuery = {
    index: "ticket-view",
    where: unplaced,
    computed: {
      completedRank: {
        type: "number",
        cases: [{ when: { field: "statusId", op: "in", value: completedStatusIds }, value: 0 }],
        otherwise: 1,
      },
    },
    fields: ["id", "dependsOn"],
    orderBy: [
      { field: "completedRank", direction: "asc" },
      { field: "position", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    limit: 100,
  };
  const window = (await storage.records.query(query)).records;
  if (!window.length) return window;
  const ids = window.map(({ fields }) => fields.id);
  const ordered = orderedWindow(window);
  if (ordered) {
    if (window.length < 100 || window.every((row) => dependencies(row).every((id) => ids.includes(id)))) return ordered;
    const external = await storage.records.query({
      index: "ticket-view",
      fields: [],
      limit: 1,
      where: {
        all: [
          { field: "id", op: "in", value: ids },
          {
            exists: {
              index: "ticket-view",
              on: [{ sourceField: "dependsOn", relatedField: "id", op: "contains" }],
              where: { all: [unplaced, { field: "id", op: "notIn", value: ids }] },
            },
          },
        ],
      },
    });
    if (!external.records.length) return ordered;
  }
  return (
    await storage.records.query({
      ...query,
      fields: ["id"],
      dependencyOrder: { idField: "id", dependenciesField: "dependsOn" },
    })
  ).records;
};
