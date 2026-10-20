import type { ResourceRenumberedEvent } from "pstdio-api-contracts/extension-kernel";
import {
  type DocumentStore,
  reconcileResourceNumbers,
  resourceNumbers,
  resourceNumbersDocumentId,
  resourceShorthand,
} from "pstdio-sync";
import type { createDocumentStorageDBService } from "./extension-storage/document-storage";

export const createResourceNumberStore = (documents: ReturnType<typeof createDocumentStorageDBService>) => {
  const listeners = new Set<(event: ResourceRenumberedEvent & { projectId: string }) => void>();
  const underlying = documents.documents.open(resourceNumbersDocumentId);
  const transaction: DocumentStore["transaction"] = async (owner, action) => {
    const events: ResourceRenumberedEvent[] = [];
    const value = await underlying.transaction(owner, async (state) => {
      const before = new Map(
        [...resourceNumbers(state.document)].map(([id, resource]) => [id, resourceShorthand(resource)]),
      );
      const value = await action(state);
      const repaired = reconcileResourceNumbers(state.document);
      for (const resource of resourceNumbers(state.document).values()) {
        const previousShorthand =
          before.get(resource.id) ?? repaired.find((change) => change.resource.id === resource.id)?.previousShorthand;
        const shorthand = resourceShorthand(resource);
        if (previousShorthand && previousShorthand !== shorthand)
          events.push({
            resource: {
              type: resource.kind,
              id: resource.id,
              extensionId: resource.extensionId,
              projectId: owner.workbenchId,
            },
            previousShorthand,
            shorthand,
          });
      }
      return value;
    });
    for (const event of events) for (const listener of listeners) listener({ ...event, projectId: owner.workbenchId });
    return value;
  };
  return {
    documentStore: { transaction },
    watch(listener: (event: ResourceRenumberedEvent & { projectId: string }) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
