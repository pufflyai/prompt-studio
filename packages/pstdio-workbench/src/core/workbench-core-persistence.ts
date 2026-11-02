import type { LayoutPersistenceAdapter } from "./registries/layout/layout-model";

export const disposeLayoutPersistence = (persistence: LayoutPersistenceAdapter | undefined) => {
  // Save pending writes before the adapter releases its resources.
  persistence?.flush?.();
  persistence?.dispose?.();
};
