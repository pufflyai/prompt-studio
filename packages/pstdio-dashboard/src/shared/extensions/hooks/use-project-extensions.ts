import { toaster } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommandExecuteResponse } from "pstdio-api-contracts";
import { executeExtensionCommand, getProjectExtensionMetadata } from "../api";
import { publishExtensionCommandEvent } from "../extension-webview-broadcast";

export const useProjectExtensionMetadata = (projectId: string | undefined) =>
  useQuery({
    queryKey: ["project-extension-metadata", projectId],
    queryFn: () => getProjectExtensionMetadata(projectId!),
    enabled: Boolean(projectId),
  });

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
      await queryClient.invalidateQueries({ queryKey: ["project-extension-metadata", projectId] });
    },
  });
};
