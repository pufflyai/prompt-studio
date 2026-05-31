import type { CommandExecuteResponse, ListProjectExtensionsResponse, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { type CollectionChange, subscribeCollections } from "@/features/sync/collections";
import {
  executeExtensionCommand,
  getProjectExtensionMetadata,
  listProjectExtensions,
  setProjectExtensionEnabled,
  uninstallProjectExtension,
} from "../api";
import { publishExtensionCommandEvent } from "../extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "../types";

const projectExtensionsQueryKey = (projectId: string | undefined) => ["project-extensions", projectId] as const;
const projectExtensionMetadataQueryKey = (projectId: string | undefined) =>
  ["project-extension-metadata", projectId] as const;
const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);

const removeByExtensionId = <T extends { extensionId: string }>(items: T[] | undefined, extensionId: string) =>
  items?.filter((item) => item.extensionId !== extensionId);

const removeProjectExtensionMetadata = (metadata: DashboardExtensionMetadata, extension: ProjectExtensionInstance) => ({
  ...metadata,
  extensions: metadata.extensions.filter((item) => item.id !== extension.extensionId),
  commands: removeByExtensionId(metadata.commands, extension.extensionId) ?? [],
  menuContributions: removeByExtensionId(metadata.menuContributions, extension.extensionId) ?? [],
  modes: removeByExtensionId(metadata.modes, extension.extensionId) ?? [],
  views: removeByExtensionId(metadata.views, extension.extensionId) ?? [],
  routes: removeByExtensionId(metadata.routes, extension.extensionId) ?? [],
  navigation: removeByExtensionId(metadata.navigation, extension.extensionId) ?? [],
  treeItems: removeByExtensionId(metadata.treeItems, extension.extensionId),
  settingsPanels: metadata.settingsPanels.filter((panel) => panel.extensionInstanceId !== extension.id),
  dataRenderers: removeByExtensionId(metadata.dataRenderers, extension.extensionId),
  settingsDefinitions: removeByExtensionId(metadata.settingsDefinitions, extension.extensionId),
  diagnostics: metadata.diagnostics.filter((diagnostic) => diagnostic.extensionId !== extension.extensionId),
});

const removeProjectExtensionFromCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string | undefined,
  instanceId: string,
) => {
  const extensionsKey = projectExtensionsQueryKey(projectId);
  const metadataKey = projectExtensionMetadataQueryKey(projectId);
  const cachedExtensions = queryClient.getQueryData<ListProjectExtensionsResponse>(extensionsKey);
  const removedExtension = cachedExtensions?.extensions.find((extension) => extension.id === instanceId);

  queryClient.setQueryData<ListProjectExtensionsResponse>(extensionsKey, (data) => {
    if (!data) return data;
    return { ...data, extensions: data.extensions.filter((extension) => extension.id !== instanceId) };
  });

  if (!removedExtension) return;

  queryClient.setQueryData<DashboardExtensionMetadata>(metadataKey, (metadata) => {
    if (!metadata) return metadata;
    return removeProjectExtensionMetadata(metadata, removedExtension);
  });
};

const invalidateExtensionQueries = (queryClient: ReturnType<typeof useQueryClient>, projectId: string | undefined) => {
  queryClient.invalidateQueries({ queryKey: projectExtensionsQueryKey(projectId) });
  queryClient.invalidateQueries({ queryKey: projectExtensionMetadataQueryKey(projectId) });
};

const useInvalidateExtensionQueriesOnSync = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeCollections((change) => {
        if (!extensionSyncTables.has(change.table)) return;
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
    mutationFn: ({ instanceId }: { instanceId: string }) => {
      if (!projectId) throw new Error("Project id is required to uninstall extensions.");
      return uninstallProjectExtension(projectId, instanceId);
    },
    onSuccess: (_, variables) => {
      removeProjectExtensionFromCache(queryClient, projectId, variables.instanceId);
      invalidateExtensionQueries(queryClient, projectId);
    },
  });
};

const surfaceCommandOutcome = (response: CommandExecuteResponse) => {
  const { outcome } = response;

  for (const notice of outcome.notices ?? []) {
    toaster.create({ type: notice.type, title: notice.title, description: notice.message });
  }

  if (outcome.status === "rejected") {
    toaster.create({
      type: "warning",
      title: "Extension command rejected",
      description: outcome.reason ?? outcome.code ?? "Command was rejected by middleware.",
    });
    return;
  }

  if (outcome.status === "error") {
    toaster.create({
      type: "error",
      title: "Extension command failed",
      description: outcome.error?.message ?? outcome.reason ?? "Command threw an error.",
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
