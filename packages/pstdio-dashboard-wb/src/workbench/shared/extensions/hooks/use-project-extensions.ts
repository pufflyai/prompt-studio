import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  executeExtensionCommand,
  getProjectExtensionMetadata,
  listProjectExtensions,
  setProjectExtensionEnabled,
  uninstallProjectExtension,
} from "../api";
import { collectExtensionCommandNotifications } from "../command-outcome";
import { publishExtensionCommandEvent } from "../extension-webview-broadcast";

export const useProjectExtensionMetadata = (projectId: string | undefined) =>
  useQuery({
    queryKey: ["project-extension-metadata", projectId],
    queryFn: () => getProjectExtensionMetadata(projectId!),
    enabled: Boolean(projectId),
  });

export const useProjectExtensions = (projectId: string | undefined) =>
  useQuery({
    queryKey: ["project-extensions", projectId],
    queryFn: () => listProjectExtensions(projectId!),
    enabled: Boolean(projectId),
  });

const invalidateExtensionQueries = (queryClient: ReturnType<typeof useQueryClient>, projectId: string | undefined) => {
  queryClient.invalidateQueries({ queryKey: ["project-extensions", projectId] });
  queryClient.invalidateQueries({ queryKey: ["project-extension-metadata", projectId] });
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
      await queryClient.invalidateQueries({ queryKey: ["project-extension-metadata", projectId] });
    },
  });
};
