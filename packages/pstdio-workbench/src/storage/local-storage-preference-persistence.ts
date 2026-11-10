import type { PreferencePersistenceAdapter, PreferenceValue } from "../core";
import type { WorkbenchStorageLike } from "./local-storage-persistence-helpers";
import {
  observePreferenceStorage,
  type PreferenceStorageEvents,
  publishPreferenceStorageChange,
} from "./preference-storage-observation";

export const createLocalStoragePreferencePersistence = (
  storage: WorkbenchStorageLike,
  key: string,
  events?: PreferenceStorageEvents,
) => {
  let lastRaw: string | null = null;
  let values: Record<string, PreferenceValue> | undefined;

  const readValues = () => {
    // Check storage on every read so writes from other adapters or windows remain visible.
    const raw = storage.getItem(key);
    if (raw !== lastRaw) {
      lastRaw = raw;
      values = undefined;
      if (raw) {
        try {
          values = JSON.parse(raw);
        } catch {
          // Invalid stored preferences have the same fallback as missing preferences.
        }
      }
    }
    return values;
  };

  const persistence: PreferencePersistenceAdapter = {
    getValue: (name, scope) => {
      const value = readValues()?.[JSON.stringify([name, scope.scope, scope.scopeId])];
      // Previously each read parsed a fresh object. Keep that isolation for mutable values.
      return value !== null && typeof value === "object" ? structuredClone(value) : value;
    },
    setValue: (name, value, scope) => {
      storage.setItem(
        key,
        JSON.stringify({ ...readValues(), [JSON.stringify([name, scope.scope, scope.scopeId])]: value }),
      );
      publishPreferenceStorageChange(storage, key, { name, scope });
    },
    onDidChange: (listener) => observePreferenceStorage(storage, key, listener, events),
  };
  return persistence;
};
