import type { ExtensionStorageApi, StoragePredicate, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { REPORTS_COLLECTION, reportsCollection } from "./collections";

export const reportLookupIndex: StorageRecordIndex = {
  name: "report-workspace",
  collection: REPORTS_COLLECTION,
  equality: ["workspace"],
  fields: {
    workspace: { path: ["workspaceShorthand"], type: "string" },
    name: { path: ["name"], type: "string" },
    id: { path: ["id"], type: "string" },
  },
};

export const findReport = async (storage: ExtensionStorageApi, workspaceShorthand: string, name?: string) => {
  const workspace: StoragePredicate = { field: "workspace", op: "eq", value: workspaceShorthand };
  const { records } = await storage.records.query({
    index: reportLookupIndex.name,
    fields: ["id", "name"],
    limit: 2,
    where: name === undefined ? workspace : { all: [workspace, { field: "name", op: "eq", value: name }] },
  });
  if (name === undefined && records.length !== 1)
    throw new Error("Pass --name when the workspace has zero or multiple reports.");
  if (records.length > 1) {
    // Older collections can contain duplicate names. Preserve their original sort-order tie break.
    return (
      (await reportsCollection(storage).list()).find(
        (row) => row.workspaceShorthand === workspaceShorthand && row.name === name,
      ) ?? null
    );
  }
  const fields = records[0]?.fields;
  if (!fields) return null;
  if (typeof fields.id !== "string" || typeof fields.name !== "string")
    throw new Error("Invalid stored report identity");
  return { id: fields.id, name: fields.name };
};
