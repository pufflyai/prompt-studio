import type { PreferenceScopeRef, PreferenceValue, WorkbenchCore } from "../../core";

export interface WebviewOwnedPreferences {
  get(name: string, scope?: PreferenceScopeRef): Promise<PreferenceValue | undefined> | PreferenceValue | undefined;
  set(name: string, value: PreferenceValue, scope: PreferenceScopeRef): Promise<void> | void;
}

export const createWebviewPreferencesAdapter = (input: {
  workbench: WorkbenchCore;
  extensionId?: string;
  ownedPreferences?: WebviewOwnedPreferences;
  warn?: (message: string) => void;
}) => {
  const registry = input.workbench.preferences;
  const owner = () => {
    if (!input.extensionId) throw new Error("Preferences require the calling extension identity");
    return input.extensionId;
  };
  const registered = (name: string) => {
    const schema = registry.getSchema(name);
    if (schema && input.extensionId && schema.ownerId !== "workbench.core" && schema.ownerId !== input.extensionId)
      (input.warn ?? console.warn)(
        `Cross-extension preference access to ${name} is deprecated. Use preferences owned by ${input.extensionId}.`,
      );
    return Boolean(schema);
  };
  return {
    get: (name: string, scope?: PreferenceScopeRef) => {
      if (registered(name)) return registry.getValue(name, scope);
      owner();
      return input.ownedPreferences?.get(name, scope) ?? registry.getOwnedValue(owner(), name, scope);
    },
    set: (name: string, value: PreferenceValue, scope: PreferenceScopeRef) => {
      if (scope.scope === "default") throw new Error("preference_scope_read_only");
      if (registered(name)) {
        return registry.setValue(name, value, scope);
      }
      owner();
      return input.ownedPreferences
        ? input.ownedPreferences.set(name, value, scope)
        : registry.setOwnedValue(owner(), name, value, scope);
    },
  };
};
