import type { LayoutPersistenceAdapter } from "./registries/layout/layout-model";
import type { TreeRendererPersistenceAdapter } from "./registries/renderers/tree-renderer-types";

export const createTreePersistenceLifetime = (persistence: TreeRendererPersistenceAdapter | undefined) => {
  let closed = false;
  return {
    adapter: persistence && {
      getTreeStates: () => persistence.getTreeStates(),
      setTreeStates: (states: Parameters<TreeRendererPersistenceAdapter["setTreeStates"]>[0]) => {
        if (!closed) persistence.setTreeStates(states);
      },
    },
    close: () => {
      closed = true;
    },
  };
};

export const disposeLayoutPersistence = (persistence: LayoutPersistenceAdapter | undefined) => {
  // Save pending writes before the adapter releases its resources.
  try {
    persistence?.flush?.();
  } finally {
    persistence?.dispose?.();
  }
};
