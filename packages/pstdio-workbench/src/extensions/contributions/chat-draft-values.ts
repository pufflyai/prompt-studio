import type { ChatDraft, ControlValueMap } from "@pstdio/sdk/extensions";

const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Local ownership follows the current complete value map; actions guard each captured control independently. */
export const createChatDraftValues = () => {
  const owned = new Set<string>();
  const versions = new Map<string, number>();
  let revision = 0;
  const replace = (before: ControlValueMap, next: ControlValueMap) => {
    for (const key of new Set([...Object.keys(before), ...Object.keys(next)]))
      if (!equal(before[key], next[key])) versions.set(key, ++revision);
    owned.clear();
    for (const key of Object.keys(next)) owned.add(key);
  };
  return {
    replace,
    capture: () => new Map(versions),
    hydrate(values: ControlValueMap) {
      for (const key of Object.keys(values)) {
        owned.add(key);
        versions.set(key, ++revision);
      }
    },
    snapshot(draft: ChatDraft, incoming?: ControlValueMap, expected?: Map<string, number>) {
      const values = { ...draft.values };
      let changed = false;
      for (const [key, value] of Object.entries(incoming ?? {})) {
        if (expected ? (versions.get(key) ?? 0) !== (expected.get(key) ?? 0) : owned.has(key)) continue;
        if (expected) owned.add(key);
        if (equal(values[key], value)) continue;
        values[key] = value;
        changed = true;
        versions.set(key, ++revision);
      }
      return { draft: changed ? { ...draft, values } : draft, changed };
    },
  };
};
