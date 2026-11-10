import { useSyncExternalStore } from "react";
import { type CollectionSelection, createCollectionSelection } from "./collection-selection";
import { getRuntimeCollections } from "./collections";
import { createRuntimeState } from "./runtime-state";

const selections = createRuntimeState(() => new Map<string, ReturnType<typeof createCollectionSelection>>());

export const useCollectionSelection = (input: CollectionSelection) => {
  const owner = getRuntimeCollections();
  const cache = selections(owner);
  const key = JSON.stringify(input);
  let selection = cache.get(key);
  if (!selection) {
    selection = createCollectionSelection(owner, input);
    cache.set(key, selection);
    // Evicted selectors remain valid for mounted users; the shared replicated rows own the data.
    if (cache.size > 128) cache.delete(cache.keys().next().value!);
  }
  return useSyncExternalStore(selection.subscribe, selection.get, selection.get);
};
