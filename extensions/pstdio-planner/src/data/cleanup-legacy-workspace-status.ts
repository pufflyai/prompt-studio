import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { plannerStorageIndexes } from "./storage-indexes";

const definitions = "workspace-status-definitions";
const initialized = "workspace-status-definitions-initialized";
const values = "workspace-status-values";

export const cleanupLegacyWorkspaceStatus = async (storage: ExtensionStorageApi) => {
  // Migration calls this before ordinary index preparation can wait for admission.
  await storage.records.defineIndexes(plannerStorageIndexes());
  for (const collection of [definitions, values])
    for (;;) {
      const page = await storage.records.query({ index: `cleanup:${collection}`, fields: [], limit: 100 });
      if (!page.records.length) break;
      const saved = await storage.records.commitIfCurrent({
        operationId: storage.ids.create(),
        edits: page.records.map(({ recordId, revision }) => ({ recordId, expectedRevision: revision, deleted: true })),
      });
      if (!saved || saved.state === "refused" || saved.state === "needs-attention")
        throw new Error(saved?.reason ?? "Legacy workspace status cleanup changed before publication");
      const published = await storage.records.readMany(page.records.map(({ recordId }) => recordId));
      if (published.some((record) => record.exists && !record.deleted))
        throw new Error("Legacy workspace status cleanup is not visible; inspect save status before continuing");
    }
  await storage.delete(initialized);
};
