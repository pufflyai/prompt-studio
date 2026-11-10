import type { PreferenceRegistry, PreferenceScope, PreferenceScopeRef } from "../../../core";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import type { PreferenceParamEntry } from "./preference-schema-to-params";

export interface ScopedPreferenceEntry extends PreferenceParamEntry {
  scope: PreferenceScopeRef;
}

export const usePreferenceEntries = (
  preferences: PreferenceRegistry,
  names: (string | { name: string; label?: string })[],
  resolveScopeId?: (scope: PreferenceScope) => string | undefined,
): ScopedPreferenceEntry[] => {
  // The selected scalar is stable even when persistence returns defensive object copies.
  const snapshot = useWorkbenchStore(preferences.store, () =>
    JSON.stringify(
      names.flatMap((candidate) => {
        const { name, label } = typeof candidate === "string" ? { name: candidate } : candidate;
        const schema = preferences.getSchema(name);
        if (!schema) return [];
        const scope = { scope: schema.scope, scopeId: resolveScopeId?.(schema.scope) };
        return [{ name, label, schema, scope, value: preferences.getValue(name, scope) }];
      }),
    ),
  );
  return JSON.parse(snapshot);
};
