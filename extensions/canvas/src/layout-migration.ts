import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { object } from "./layout";

/** Old shared fields remain migration input; current layout writes use ordinary value paths. */
export const migrateLayouts = (storage: ExtensionStorageApi) =>
  storage.migrate(1, async (_previous, migration) => {
    for (const record of await storage.records.list()) {
      if (record.shared?.kind !== "map" || record.shared.value.version !== 1 || object(record.value).version === 1)
        continue;
      await storage.records.commit({
        operationId: migration.id(record.recordId),
        edits: [{ recordId: record.recordId, replace: record.shared.value }],
      });
    }
  });
