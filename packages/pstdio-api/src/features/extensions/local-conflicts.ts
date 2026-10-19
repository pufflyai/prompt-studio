import type { StorageConflictHandler } from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerHostDeps } from "pstdio-extensions";
import {
  ConflictedStorageInputError,
  withConflictReadBoundary,
} from "../../services/shared-files/conflict-read-boundary";
import { createRecordAssets } from "./command-environment/record-assets";
import type { ExtensionsRouteDeps } from "./deps";
import { openPublishedCatalog, publicationSchema, publishedOwner } from "./publication/catalog";
import { loadPublishedHandlers } from "./published-handler-cache";

export const mergePublishedConflict = async (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId: string; conflictId: string },
) => {
  const { projectId, extensionId, conflictId } = input;
  const catalog = await openPublishedCatalog(deps, projectId);
  const publicationRecord = (await catalog.readState()).accepted?.records[extensionId];
  if (!publicationRecord || publicationRecord.deleted || !publicationRecord.asset) return;
  const publication = publicationSchema.parse(publicationRecord.value);
  if (!publication.enabled || publication.revision !== publicationRecord.asset.sha256) return;
  const owner = { workbenchId: projectId, extensionId };
  const storage = await deps.extensionStorageService.open({
    owner,
    assets: createRecordAssets(deps.assetTransferService, owner),
  });
  if ((await storage.readState()).accepted?.publishedRevision !== publication.revision) return;
  try {
    const inspection = await storage.records.inspect(conflictId);
    const bytes = await new Response(
      await deps.assetTransferService.read(publishedOwner(projectId), publicationRecord.asset),
    ).blob();
    const prepared = await loadPublishedHandlers(deps.extensionStorageService, {
      bytes,
      revision: publication.revision,
      extensionId,
    });
    const handlers = prepared.loaded.definition.conflictHandlers as Record<string, StorageConflictHandler> | undefined;
    for (const [handlerId, handler] of Object.entries(handlers ?? {})) {
      if (typeof handler !== "function") continue;
      const edits = await handler(structuredClone(inspection));
      if (!Array.isArray(edits)) continue;
      // Publication can advance while a pure handler computes its proposal.
      const current = (await catalog.readState()).accepted?.records[extensionId];
      if (!current || current.deleted || publicationSchema.parse(current.value).revision !== publication.revision)
        return;
      return await storage.records.resolve({
        operationId: crypto.randomUUID(),
        conflictId,
        expectedConflicts: inspection.expectedConflicts,
        expectedInputs: inspection.expectedInputs,
        capturedOperationIds: inspection.capturedOperationIds,
        handler: { publishedRevision: publication.revision, handlerId },
        choose: "remote",
        edits,
      });
    }
  } catch {
    // Missing packages, failed handlers and invalid proposals all retain the original alternatives.
  }
};

export const localExecutionBoundaries = (deps: ExtensionsRouteDeps) =>
  ({
    runWithStorageBoundary: withConflictReadBoundary,
    beforeDispatch: async ({ projectId, extensionId, recordIds }) => {
      if (!recordIds.length) return;
      const storage = await deps.extensionStorageService.open({ owner: { workbenchId: projectId, extensionId } });
      const relevant = (await storage.records.conflicts()).filter((conflict) =>
        conflict.recordIds.some((id) => recordIds.includes(id)),
      );
      for (const conflict of relevant)
        await mergePublishedConflict(deps, { projectId, extensionId, conflictId: conflict.conflictId });
      const conflicts = await storage.records.conflicts();
      for (const recordId of recordIds) {
        const conflict = conflicts.find((entry) => entry.recordIds.includes(recordId));
        if (conflict) throw new ConflictedStorageInputError(recordId, conflict.conflictId);
      }
    },
  }) satisfies Pick<CommandRunnerHostDeps, "runWithStorageBoundary" | "beforeDispatch">;
