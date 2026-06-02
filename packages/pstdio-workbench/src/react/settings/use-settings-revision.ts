import { useSyncExternalStore } from "react";
import type { SettingsRegistry } from "../../core";

export const useSettingsRevision = (settings: SettingsRegistry) =>
  useSyncExternalStore(
    (listener) => settings.store.subscribe(() => listener()),
    () => settings.store.getState().revision,
    () => settings.store.getState().revision,
  );
