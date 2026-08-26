import type {
  CommandExecuteResponse,
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { type CollectionChange, subscribeCollections } from "@/lib/sync/collections";
import {
  attemptExtensionFix,
  executeExtensionCommand,
  getExtensionContributions,
  getMarketplaceExtensionContributions,
  getProjectExtensionMetadata,
  installMarketplaceExtension,
  listProjectExtensionSettings,
  listProjectExtensions,
  reloadProjectExtension,
  setExtensionAutomationEnabled,
  setProjectExtensionEnabled,
  uninstallProjectExtension,
  updateProjectExtensionSetting,
  upgradeProjectExtension,
} from "./api";
import { collectExtensionCommandNotifications } from "./command-outcome";
import { publishExtensionCommandEvent } from "./extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "./types";

const projectExtensionsQueryKey = (projectId: string | undefined) => ["project-extensions", projectId] as const;
const projectExtensionMetadataQueryKey = (projectId: string | undefined) =>
  ["project-extension-metadata", projectId] as const;
const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);

const invalidateExtensionQueries = (queryClient: ReturnType<typeof useQueryClient>, projectId: string | undefined) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: projectExtensionsQueryKey(projectId) }),
    queryClient.invalidateQueries({ queryKey: projectExtensionMetadataQueryKey(projectId) }),
    queryClient.invalidateQueries({ queryKey: ["extension-contributions", projectId] }),
    // Harness availability follows extension enablement.
    queryClient.invalidateQueries({ queryKey: ["agents-info"] }),
    queryClient.invalidateQueries({ queryKey: ["agent-models"] }),
  ]);

const storeProjectExtension = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string | undefined,
  extension: ProjectExtensionInstance,
) => {
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
};

const removeProjectExtension = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string | undefined,
  instanceId: string,
) => {
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
};

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

const storeExtensionAutomation = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string | undefined,
  instanceId: string,
  automation: WorkbenchExtensionAutomationRecord,
) => {
  queryClient.setQueryData<DashboardExtensionMetadata>(projectExtensionMetadataQueryKey(projectId), (current) =>
    replaceAutomation(current, automation, instanceId),
  );
  queryClient.setQueryData<DashboardExtensionMetadata>(["extension-contributions", projectId, instanceId], (current) =>
    replaceAutomation(current, automation, instanceId),
  );
};

// Extension installs/enables sync over the live collections, so refresh the
// project extension queries whenever those tables change.
const useInvalidateExtensionQueriesOnSync = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeCollections((change) => {
        if (!change || !extensionSyncTables.has(change.table)) return;
        void invalidateExtensionQueries(queryClient, projectId);
      }),
    [projectId, queryClient],
  );
};

export const useProjectExtensionMetadata = (projectId: string | undefined) => {
  useInvalidateExtensionQueriesOnSync(projectId);
  return useQuery({
    queryKey: projectExtensionMetadataQueryKey(projectId),
    queryFn: () => getProjectExtensionMetadata(projectId!),
    enabled: Boolean(projectId),
  });
};

export const useProjectExtensions = (projectId: string | undefined) => {
  useInvalidateExtensionQueriesOnSync(projectId);
  return useQuery({
    queryKey: projectExtensionsQueryKey(projectId),
    queryFn: () => listProjectExtensions(projectId!),
    enabled: Boolean(projectId),
  });
};

export const useInstallMarketplaceExtension = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ installName }: { installName: string }) => {
      if (!projectId) throw new Error("Project id is required to install extensions.");
      return installMarketplaceExtension(projectId, installName);
    },
    onSuccess: (result) => {
      storeProjectExtension(queryClient, projectId, result.extension);
      void invalidateExtensionQueries(queryClient, projectId);
    },
  });
};

export const useSetProjectExtensionEnabled = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, enabled }: { instanceId: string; enabled: boolean }) => {
      if (!projectId) throw new Error("Project id is required to update extensions.");
      return setProjectExtensionEnabled(projectId, instanceId, enabled);
    },
    onSuccess: (extension) => {
      storeProjectExtension(queryClient, projectId, extension);
      void invalidateExtensionQueries(queryClient, projectId);
    },
  });
};

export const useSetExtensionAutomationEnabled = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      instanceId,
      automationId,
      enabled,
    }: {
      instanceId: string;
      automationId: string;
      enabled: boolean;
    }) => {
      if (!projectId) throw new Error("Project id is required to update automations.");
      return setExtensionAutomationEnabled(projectId, instanceId, automationId, enabled);
    },
    onSuccess: (automation, variables) => {
      storeExtensionAutomation(queryClient, projectId, variables.instanceId, automation);
      void invalidateExtensionQueries(queryClient, projectId);
    },
  });
};

export const useReloadProjectExtension = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId }: { instanceId: string }) => {
      if (!projectId) throw new Error("Project id is required to reload extensions.");
      return reloadProjectExtension(projectId, instanceId);
    },
    onSuccess: () => invalidateExtensionQueries(queryClient, projectId),
  });
};

export const useUpgradeProjectExtension = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId }: { instanceId: string }) => {
      if (!projectId) throw new Error("Project id is required to upgrade extensions.");
      return upgradeProjectExtension(projectId, instanceId);
    },
    onSuccess: () => invalidateExtensionQueries(queryClient, projectId),
  });
};

export const useAttemptExtensionFix = (projectId: string | undefined) => {
  return useMutation({
    mutationFn: ({ instanceId }: { instanceId: string }) => {
      if (!projectId) throw new Error("Project id is required to fix extensions.");
      return attemptExtensionFix(projectId, instanceId);
    },
  });
};

export const useExtensionContributions = (projectId: string | undefined, instanceId: string | undefined) => {
  return useQuery({
    queryKey: ["extension-contributions", projectId, instanceId],
    queryFn: () => getExtensionContributions(projectId!, instanceId!),
    enabled: Boolean(projectId && instanceId),
  });
};

export const useMarketplaceExtensionContributions = (
  projectId: string | undefined,
  installName: string | undefined,
) => {
  return useQuery({
    queryKey: ["marketplace-extension-contributions", projectId, installName],
    queryFn: () => getMarketplaceExtensionContributions(projectId!, installName!),
    enabled: Boolean(projectId && installName),
  });
};

const projectExtensionSettingsQueryKey = (projectId: string | undefined, instanceId: string | undefined) =>
  ["project-extension-settings", projectId, instanceId] as const;

export const useProjectExtensionSettings = (projectId: string | undefined, instanceId: string | undefined) => {
  return useQuery({
    queryKey: projectExtensionSettingsQueryKey(projectId, instanceId),
    queryFn: () => listProjectExtensionSettings(projectId!, instanceId!),
    enabled: Boolean(projectId && instanceId),
  });
};

export const useUpdateProjectExtensionSetting = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, key, value }: { instanceId: string; key: string; value: unknown }) => {
      if (!projectId) throw new Error("Project id is required to update extension settings.");
      return updateProjectExtensionSetting(projectId, instanceId, key, value);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: projectExtensionSettingsQueryKey(projectId, variables.instanceId) });
    },
  });
};

export const useUninstallProjectExtension = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, deleteUserData }: { instanceId: string; deleteUserData?: boolean }) => {
      if (!projectId) throw new Error("Project id is required to uninstall extensions.");
      return uninstallProjectExtension(projectId, instanceId, deleteUserData);
    },
    onSuccess: (_result, variables) => {
      removeProjectExtension(queryClient, projectId, variables.instanceId);
      void invalidateExtensionQueries(queryClient, projectId);
    },
  });
};

const surfaceCommandOutcome = (response: CommandExecuteResponse) => {
  for (const notification of collectExtensionCommandNotifications(response)) {
    toaster.create({
      type: notification.level,
      title: notification.title,
      description: notification.message,
    });
  }
};

export const useExecuteExtensionCommand = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commandId, body }: { commandId: string; body: unknown }) => {
      if (!projectId) throw new Error("Project id is required to execute extension commands.");
      return executeExtensionCommand(projectId, commandId, body);
    },
    onSuccess: async (response) => {
      surfaceCommandOutcome(response);
      publishExtensionCommandEvent(response);
      await queryClient.invalidateQueries({ queryKey: projectExtensionMetadataQueryKey(projectId) });
    },
  });
};
