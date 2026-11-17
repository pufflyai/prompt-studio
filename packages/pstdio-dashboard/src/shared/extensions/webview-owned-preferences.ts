import type { PreferenceScopeRef, PreferenceValue } from "@pstdio/workbench";
import { getApiClient, getRuntimeApiClient } from "@/lib/api";
import { persistWebviewPreference } from "./webview-preference-writes";

const webviewScope = (scope?: PreferenceScopeRef) => {
  if (!scope) return undefined;
  if (scope.scope === "repo") throw new Error("Repository preferences are unavailable in extension webviews.");
  return { scope: scope.scope, scopeId: scope.scopeId };
};

export const createDashboardOwnedPreferences = (input: {
  runtime?: import("@/lib/sync/collections").RuntimeCollections;
  projectId?: string;
  instanceId?: string;
  installName?: string;
}) => {
  const client = (input.runtime ? getRuntimeApiClient(input.runtime) : getApiClient()).extensions;
  const get = (name: string, scope?: PreferenceScopeRef) => {
    if (input.projectId && input.instanceId)
      return client.projectPreferences.get(input.projectId, input.instanceId, name, webviewScope(scope));
    if (input.installName) return client.installedPreferences.get(input.installName, name, webviewScope(scope));
    throw new Error("Preferences require an extension owner.");
  };
  const write = (name: string, value: PreferenceValue, scope: PreferenceScopeRef) => {
    if (input.projectId && input.instanceId)
      return client.projectPreferences.set(input.projectId, input.instanceId, name, value, webviewScope(scope));
    if (input.installName) return client.installedPreferences.set(input.installName, name, value, webviewScope(scope));
    throw new Error("Preferences require an extension owner.");
  };
  return {
    identity: [input.projectId, input.instanceId, input.installName],
    get: async (name: string, scope?: PreferenceScopeRef) => (await get(name, scope)).value,
    set: async (name: string, value: PreferenceValue, scope: PreferenceScopeRef) => {
      await persistWebviewPreference(client, [input.projectId, input.instanceId, input.installName, name, scope], () =>
        write(name, value, scope),
      );
    },
  };
};
