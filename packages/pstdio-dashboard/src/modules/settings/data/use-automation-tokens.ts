import type { IssueAutomationTokenInput } from "@pstdio/sdk/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { issueAutomationToken, listAutomationTokens, revokeAutomationToken } from "./automation-tokens-api";

const tokensKey = (projectId: string) => ["automation-tokens", projectId] as const;

export const useAutomationTokens = (projectId: string) =>
  useQuery({
    queryKey: tokensKey(projectId),
    queryFn: () => listAutomationTokens(projectId),
    enabled: Boolean(projectId),
  });

export const useIssueAutomationToken = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<IssueAutomationTokenInput, "projectId">) => issueAutomationToken({ ...input, projectId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tokensKey(projectId) }),
  });
};

export const useRevokeAutomationToken = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeAutomationToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tokensKey(projectId) }),
  });
};
