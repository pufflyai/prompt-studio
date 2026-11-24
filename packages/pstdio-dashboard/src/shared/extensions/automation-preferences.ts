import type { WorkbenchExtensionAutomationRecord } from "@pstdio/sdk/api";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createProjectExtensionCache } from "./project-extension-cache";
import { extensionInventorySubject } from "./use-extension-mutation";

interface AutomationPreference {
  instanceId: string;
  automationId: string;
  enabled: boolean;
}

const domain = "extension.automation-preference";
const automationSubject = (projectId: string, preference: AutomationPreference) =>
  operationSubject("automation", projectId, preference.instanceId, preference.automationId);

export const getAutomationPreferences = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const client = getDashboardQueryClient(owner);
  const api = getRuntimeApiClient(owner).extensions;
  return {
    subscribe: operations.subscribe,
    snapshot: operations.getSnapshot,
    async update(projectId: string, preference: AutomationPreference, assertCurrent: () => void) {
      const { instanceId, automationId, enabled } = preference;
      const subject = automationSubject(projectId, preference);
      if (operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject)))
        throw new Error("This automation already has a pending change. Check System activity for recovery.");
      return operations.submit({
        domain,
        projectId,
        subjects: [extensionInventorySubject(projectId, instanceId), subject],
        title: "Update automation",
        sourceCommand: { id: dashboardCommandIds.openExtensions },
        draft: preference,
        intent: preference,
        classify: classifyApiWrite,
        write(signal) {
          signal.throwIfAborted();
          assertCurrent();
          return api.setAutomationEnabled(projectId, instanceId, automationId, enabled);
        },
        async reconcile(automation, signal) {
          signal.throwIfAborted();
          const cache = createProjectExtensionCache(client, projectId, queries, { instanceId });
          try {
            await cache.storeAutomation(instanceId, automation);
          } finally {
            cache.dispose();
          }
        },
        async check(signal) {
          const metadata = await api.contributions(projectId, instanceId, { signal });
          const automation = metadata.automations?.find(
            (entry) => entry.id === automationId && entry.extensionInstanceId === instanceId,
          );
          return automation?.enabled === enabled ? { status: "confirmed", result: automation } : { status: "unknown" };
        },
      }).result;
    },
  };
});

export const useProjectedAutomationPreferences = (
  projectId: string | undefined,
  automations: readonly WorkbenchExtensionAutomationRecord[] = [],
) => {
  const preferences = getAutomationPreferences();
  const { pending } = useSyncExternalStore(preferences.subscribe, preferences.snapshot, preferences.snapshot);
  const active = pending.filter((entry) => entry.projectId === projectId && entry.domain === domain);
  const subjects = new Set(active.flatMap((entry) => entry.subjects));
  const intents = active.flatMap((entry) => (entry.intent ? [entry.intent as AutomationPreference] : []));
  const instances = new Set(
    automations.flatMap(({ extensionInstanceId }) =>
      projectId && extensionInstanceId && subjects.has(extensionInventorySubject(projectId, extensionInstanceId))
        ? [extensionInstanceId]
        : [],
    ),
  );
  const rows = automations.map((row) => {
    const intent = intents.find(
      ({ instanceId, automationId }) => row.extensionInstanceId === instanceId && row.id === automationId,
    );
    return intent ? { ...row, enabled: intent.enabled } : row;
  });
  return { rows, instances };
};
