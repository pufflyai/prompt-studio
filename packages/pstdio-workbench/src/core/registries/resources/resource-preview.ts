import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore } from "../../shared/store/workbench-store";

type ResourceChange = { label: string } | { removed: true };

export type ResourcePreviewChanges = ReadonlyMap<symbol, { resource: ResourceRef; change: ResourceChange }>;

export const resolveResourcePreview = (resource: ResourceRef, changes: ResourcePreviewChanges) => {
  let result: ResourceRef | undefined = resource;
  for (const intent of changes.values()) {
    if (resourceKey(intent.resource) !== resourceKey(resource)) continue;
    result = "removed" in intent.change ? undefined : { ...resource, label: intent.change.label };
  }
  return result;
};

export const createResourcePreview = () => {
  const store = createWorkbenchStore<{ changes: ResourcePreviewChanges }>({
    name: "workbench.resource-preview",
    initialState: { changes: new Map() },
  });
  const writes = new Map<string, Promise<unknown>>();
  const refreshers = new Set<(resource: ResourceRef) => Promise<void>>();
  const remove = (token: symbol) => {
    const changes = new Map(store.getState().changes);
    changes.delete(token);
    store.setState({ changes });
  };
  return {
    store,
    resolve(resource: ResourceRef) {
      return resolveResourcePreview(resource, store.getState().changes);
    },
    persist<T>(resource: ResourceRef, save: () => Promise<T>): Promise<T> {
      const key = resourceKey(resource);
      const pending = (writes.get(key) ?? Promise.resolve()).catch(() => undefined).then(save);
      writes.set(key, pending);
      void pending
        .finally(() => {
          if (writes.get(key) === pending) writes.delete(key);
        })
        .catch(() => undefined);
      return pending;
    },
    subscribeRefresh(refresh: (resource: ResourceRef) => Promise<void>) {
      refreshers.add(refresh);
      return createDisposable(() => refreshers.delete(refresh));
    },
    begin(resource: ResourceRef, change: ResourceChange) {
      const token = Symbol("resource mutation");
      store.setState({ changes: new Map([...store.getState().changes, [token, { resource, change }]]) });
      return {
        rollback: () => remove(token),
        async commit() {
          // Keep the preview through the authoritative reads, so old snapshots cannot flash back.
          await Promise.allSettled([...refreshers].map((refresh) => refresh(resource)));
          remove(token);
        },
      };
    },
  };
};
