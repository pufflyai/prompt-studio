import type { PreferenceScopeRef, PreferenceValue } from "@pstdio/workbench";
import { apiRequest } from "@/lib/api";

export const createDashboardOwnedPreferences = (input: {
  projectId?: string;
  instanceId?: string;
  installName?: string;
}) => {
  const path = (name: string, scope?: PreferenceScopeRef) => {
    const query = new URLSearchParams();
    if (scope) {
      query.set("scope", scope.scope);
      if (scope.scopeId !== undefined) query.set("scopeId", scope.scopeId);
    }
    const prefix =
      input.projectId && input.instanceId
        ? `/v1/projects/${encodeURIComponent(input.projectId)}/extensions/${encodeURIComponent(input.instanceId)}`
        : input.installName && `/v1/extensions/installed/${encodeURIComponent(input.installName)}`;
    if (!prefix) throw new Error("Preferences require an extension owner.");
    return `${prefix}/preferences/${encodeURIComponent(name)}?${query}`;
  };
  return {
    get: async (name: string, scope?: PreferenceScopeRef) =>
      (await apiRequest<{ value?: PreferenceValue }>(path(name, scope))).value,
    set: async (name: string, value: PreferenceValue, scope: PreferenceScopeRef) => {
      await apiRequest(path(name, scope), { method: "PUT", body: { value } });
    },
  };
};
