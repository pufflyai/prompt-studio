import type { CommandExecuteResponse } from "@pstdio/sdk/api";
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
import {
  createProjectExtensionCache,
  invalidateExtensionQueries,
  projectExtensionMetadataQueryKey,
  projectExtensionsQueryKey,
} from "./project-extension-cache";

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);

// Extension installs/enables sync over the live collections, so refresh the
// project extension queries whenever those tables change.
export const useProjectExtensionSync = (projectId: string | undefined) => {
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
  return useQuery({
    queryKey: projectExtensionMetadataQueryKey(projectId),
    queryFn: () => getProjectExtensionMetadata(projectId!),
    enabled: Boolean(projectId),
  });
};

export const useProjectExtensions = (projectId: string | undefined) => {
  return useQuery({
    queryKey: projectExtensionsQueryKey(projectId),
    queryFn: () => listProjectExtensions(projectId!),
    enabled: Boolean(projectId),
  });
};

export const useInstallMarketplaceExtension = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  const cache = createProjectExtensionCache(queryClient, projectId);
  return useMutation({
    mutationFn: ({ installName }: { installName: string }) => {
      if (!projectId) throw new Error("Project id is required to install extensions.");
      return installMarketplaceExtension(projectId, installName);
    },
    onSuccess: (result) => cache.storeExtension(result.extension),
  });
};

export const useSetProjectExtensionEnabled = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  const cache = createProjectExtensionCache(queryClient, projectId);
  return useMutation({
    mutationFn: ({ instanceId, enabled }: { instanceId: string; enabled: boolean }) => {
      if (!projectId) throw new Error("Project id is required to update extensions.");
      return setProjectExtensionEnabled(projectId, instanceId, enabled);
    },
    onSuccess: (extension) => cache.storeExtension(extension),
  });
};

export const useSetExtensionAutomationEnabled = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  const cache = createProjectExtensionCache(queryClient, projectId);
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
    onSuccess: (automation, variables) => cache.storeAutomation(variables.instanceId, automation),
  });
};

export const useReloadProjectExtension = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId }: { instanceId: string }) => {
      if (!projectId) throw new Error("Project id is required to reload extensions.");
      return reloadProjectExtension(projectId, instanceId);
    },
    onSuccess: () => {
      void invalidateExtensionQueries(queryClient, projectId);
    },
  });
};

export const useUpgradeProjectExtension = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId }: { instanceId: string }) => {
      if (!projectId) throw new Error("Project id is required to upgrade extensions.");
      return upgradeProjectExtension(projectId, instanceId);
    },
    onSuccess: () => {
      void invalidateExtensionQueries(queryClient, projectId);
    },
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
  const cache = createProjectExtensionCache(queryClient, projectId);
  return useMutation({
    mutationFn: ({ instanceId, deleteUserData }: { instanceId: string; deleteUserData?: boolean }) => {
      if (!projectId) throw new Error("Project id is required to uninstall extensions.");
      return uninstallProjectExtension(projectId, instanceId, deleteUserData);
    },
    onSuccess: (_result, variables) => cache.removeExtension(variables.instanceId),
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
