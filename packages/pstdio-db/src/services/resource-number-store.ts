import type { ResourceRenumberedEvent } from "pstdio-api-contracts/extension-kernel";
import { type DocumentStore, resourceNumbers, resourceNumbersDocumentId, resourceShorthand } from "pstdio-sync";
import type { createDocumentStorageDBService } from "./extension-storage/document-storage";

export const createResourceNumberStore = (
  documents: ReturnType<typeof createDocumentStorageDBService>,
  ready = Promise.resolve(),
) => {
  const listeners = new Set<(event: ResourceRenumberedEvent & { projectId: string }) => void>();
  const underlying = documents.documents.open(resourceNumbersDocumentId);
  const transaction: DocumentStore["transaction"] = async (owner, action) => {
    await ready;
    const events: ResourceRenumberedEvent[] = [];
    let detach = () => {};
    const before = new Map<string, string>();
    let resources: ReturnType<typeof resourceNumbers> | undefined;
    let value: Awaited<ReturnType<typeof action>>;
    try {
      value = await underlying.transaction(owner, async (state) => {
        resources = resourceNumbers(state.document);
        const changed = (event: import("yjs").YMapEvent<import("pstdio-sync").NumberedResource>) => {
          for (const [id, change] of event.changes.keys) {
            if (change.oldValue && !before.has(id)) before.set(id, resourceShorthand(change.oldValue));
          }
        };
        resources.observe(changed);
        detach = () => resources?.unobserve(changed);
        return action(state);
      });
    } finally {
      detach();
    }
    for (const [id, previousShorthand] of before) {
      const resource = resources?.get(id);
      if (!resource) continue;
      const shorthand = resourceShorthand(resource);
      if (previousShorthand !== shorthand)
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
