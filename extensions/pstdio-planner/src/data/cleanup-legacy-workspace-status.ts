import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";

const definitions = "workspace-status-definitions";
const initialized = "workspace-status-definitions-initialized";
const values = "workspace-status-values";

export const cleanupLegacyWorkspaceStatus = async (storage: ExtensionStorageApi) => {
  await preparePlannerIndexes(storage);
  for (const collection of [definitions, values])
    for (;;) {
      const page = await storage.records.query({ index: `cleanup:${collection}`, fields: [], limit: 100 });
      if (!page.records.length) break;
      await storage.records.commit({
        operationId: storage.ids.create(),
        edits: page.records.map(({ recordId }) => ({ recordId, deleted: true })),
      });
    }
  await storage.delete(initialized);
};
