import type { ChatDraft, ControlValueMap } from "@pstdio/sdk/extensions";

const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Local ownership follows the current complete value map; actions guard each captured control independently. */
export const createChatDraftValues = () => {
  const owned = new Set<string>();
  const versions = new Map<string, number>();
  let revision = 0;
  const replace = (before: ControlValueMap, next: ControlValueMap) => {
    for (const key of new Set([...Object.keys(before), ...Object.keys(next)])) {
      if (equal(before[key], next[key])) continue;
      versions.set(key, ++revision);
      if (Object.hasOwn(next, key)) owned.add(key);
      else owned.delete(key);
    }
  };
  return {
    replace,
    // Explicit restoration selects every saved control, even one equal to a query default.
    claim(values: ControlValueMap) {
      for (const key of Object.keys(values)) {
        owned.add(key);
        versions.set(key, ++revision);
      }
    },
    capture: () => new Map(versions),
    hydrate(current: ControlValueMap, saved: ControlValueMap) {
      const values = { ...current };
      for (const [key, value] of Object.entries(saved)) {
        if (owned.has(key)) continue;
        values[key] = value;
        owned.add(key);
        versions.set(key, ++revision);
      }
      return values;
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
