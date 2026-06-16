import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { type CollectionChange, subscribeCollections } from "@/lib/sync/collections";
import {
  executeExtensionCommand,
  getProjectExtensionMetadata,
  listProjectExtensions,
  setProjectExtensionEnabled,
  uninstallProjectExtension,
} from "./api";
import { collectExtensionCommandNotifications } from "./command-outcome";
import { publishExtensionCommandEvent } from "./extension-webview-broadcast";

const projectExtensionsQueryKey = (projectId: string | undefined) => ["project-extensions", projectId] as const;
const projectExtensionMetadataQueryKey = (projectId: string | undefined) =>
  ["project-extension-metadata", projectId] as const;
const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);

const invalidateExtensionQueries = (queryClient: ReturnType<typeof useQueryClient>, projectId: string | undefined) => {
  queryClient.invalidateQueries({ queryKey: projectExtensionsQueryKey(projectId) });
  queryClient.invalidateQueries({ queryKey: projectExtensionMetadataQueryKey(projectId) });
  // Harness availability follows extension enablement.
  queryClient.invalidateQueries({ queryKey: ["agents-info"] });
  queryClient.invalidateQueries({ queryKey: ["agent-models"] });
};

// Extension installs/enables sync over the live collections, so refresh the
// project extension queries whenever those tables change.
const useInvalidateExtensionQueriesOnSync = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeCollections((change) => {
        if (!change || !extensionSyncTables.has(change.table)) return;
        invalidateExtensionQueries(queryClient, projectId);
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

export const useSetProjectExtensionEnabled = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, enabled }: { instanceId: string; enabled: boolean }) => {
      if (!projectId) throw new Error("Project id is required to update extensions.");
      return setProjectExtensionEnabled(projectId, instanceId, enabled);
    },
    onSuccess: () => invalidateExtensionQueries(queryClient, projectId),
  });
};

export const useUninstallProjectExtension = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, deleteUserData }: { instanceId: string; deleteUserData?: boolean }) => {
      if (!projectId) throw new Error("Project id is required to uninstall extensions.");
      return uninstallProjectExtension(projectId, instanceId, deleteUserData);
    },
    onSuccess: () => invalidateExtensionQueries(queryClient, projectId),
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
