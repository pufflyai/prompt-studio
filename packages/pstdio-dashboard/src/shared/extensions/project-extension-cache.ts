import type {
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import type { QueryClient } from "@tanstack/react-query";
import type { DashboardExtensionMetadata } from "./types";

export const projectExtensionsQueryKey = (projectId: string | undefined) => ["project-extensions", projectId] as const;

export const projectExtensionMetadataQueryKey = (projectId: string | undefined) =>
  ["project-extension-metadata", projectId] as const;

export const invalidateExtensionQueries = (queryClient: QueryClient, projectId: string | undefined) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: projectExtensionsQueryKey(projectId) }),
    queryClient.invalidateQueries({ queryKey: projectExtensionMetadataQueryKey(projectId) }),
    queryClient.invalidateQueries({ queryKey: ["extension-contributions", projectId] }),
    queryClient.invalidateQueries({ queryKey: ["agents-info"] }),
    queryClient.invalidateQueries({ queryKey: ["agent-models"] }),
  ]);

const replaceAutomation = (
  current: DashboardExtensionMetadata | undefined,
  automation: WorkbenchExtensionAutomationRecord,
  instanceId: string,
) => {
  if (!current) return current;
  let found = false;
  const automations = (current.automations ?? []).map((entry) => {
    if (entry.id !== automation.id || entry.extensionInstanceId !== instanceId) return entry;
    found = true;
    return automation;
  });

  return { ...current, automations: found ? automations : [...automations, automation] };
};

export const createProjectExtensionCache = (queryClient: QueryClient, projectId: string | undefined) => {
  const cancelProjectReads = () =>
    Promise.all([
      queryClient.cancelQueries({ queryKey: projectExtensionsQueryKey(projectId) }),
      queryClient.cancelQueries({ queryKey: projectExtensionMetadataQueryKey(projectId) }),
      queryClient.cancelQueries({ queryKey: ["extension-contributions", projectId] }),
    ]);

  const refresh = () => {
    void invalidateExtensionQueries(queryClient, projectId);
  };

  const storeExtension = async (extension: ProjectExtensionInstance) => {
    await cancelProjectReads();
    queryClient.setQueryData<ListProjectExtensionsResponse>(projectExtensionsQueryKey(projectId), (current) => {
      if (!current) return current;
      return {
        ...current,
        extensions: [...current.extensions.filter((entry) => entry.id !== extension.id), extension],
        marketplace: current.marketplace.map((entry) =>
          entry.installName === extension.installName ? { ...entry, installed: true } : entry,
        ),
      };
    });
    refresh();
  };

  const removeExtension = async (instanceId: string) => {
    await cancelProjectReads();
    queryClient.setQueryData<ListProjectExtensionsResponse>(projectExtensionsQueryKey(projectId), (current) => {
      if (!current) return current;
      const removed = current.extensions.find((extension) => extension.id === instanceId);
      if (!removed) return current;

      const extensions = current.extensions.filter((extension) => extension.id !== instanceId);
      const stillInstalled = extensions.some((extension) => extension.installName === removed.installName);
      return {
        ...current,
        extensions,
        marketplace: current.marketplace.map((entry) =>
          entry.installName === removed.installName ? { ...entry, installed: stillInstalled } : entry,
        ),
      };
    });
    refresh();
  };

  const storeAutomation = async (instanceId: string, automation: WorkbenchExtensionAutomationRecord) => {
    await cancelProjectReads();
    queryClient.setQueryData<DashboardExtensionMetadata>(projectExtensionMetadataQueryKey(projectId), (current) =>
      replaceAutomation(current, automation, instanceId),
    );
    queryClient.setQueryData<DashboardExtensionMetadata>(
      ["extension-contributions", projectId, instanceId],
      (current) => replaceAutomation(current, automation, instanceId),
    );
    refresh();
  };

  return { removeExtension, storeAutomation, storeExtension };
};
