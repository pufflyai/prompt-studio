import type { PreferenceScopeRef, PreferenceValue } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";

const webviewScope = (scope?: PreferenceScopeRef) => {
  if (!scope) return undefined;
  if (scope.scope === "repo") throw new Error("Repository preferences are unavailable in extension webviews.");
  return { scope: scope.scope, scopeId: scope.scopeId };
};

export const createDashboardOwnedPreferences = (input: {
  projectId?: string;
  instanceId?: string;
  installName?: string;
}) => {
  const client = getApiClient().extensions;
  const get = (name: string, scope?: PreferenceScopeRef) => {
    if (input.projectId && input.instanceId)
      return client.projectPreferences.get(input.projectId, input.instanceId, name, webviewScope(scope));
    if (input.installName) return client.installedPreferences.get(input.installName, name, webviewScope(scope));
    throw new Error("Preferences require an extension owner.");
  };
  const set = (name: string, value: PreferenceValue, scope: PreferenceScopeRef) => {
    if (input.projectId && input.instanceId)
      return client.projectPreferences.set(input.projectId, input.instanceId, name, value, webviewScope(scope));
    if (input.installName) return client.installedPreferences.set(input.installName, name, value, webviewScope(scope));
    throw new Error("Preferences require an extension owner.");
  };
  return {
    get: async (name: string, scope?: PreferenceScopeRef) => (await get(name, scope)).value,
    set: async (name: string, value: PreferenceValue, scope: PreferenceScopeRef) => {
      await set(name, value, scope);
    },
  };
};
