import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

const permissionKey = (projectId: string | undefined, extensionId: string) =>
  ["extension-process-environment", projectId, extensionId] as const;

export const useExtensionProcessEnvironment = (projectId: string | undefined, extensionId: string, enabled = true) =>
  useQuery({
    queryKey: permissionKey(projectId, extensionId),
    enabled: Boolean(projectId) && enabled,
    queryFn: () => getApiClient().extensions.processEnvironment.get(projectId!, extensionId),
  });

export const useGrantExtensionProcessEnvironment = (projectId: string, extensionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { names: string[]; sourceIdentity: string }) =>
      getApiClient().extensions.processEnvironment.grant(projectId, extensionId, input),
    onSuccess: (permission) => queryClient.setQueryData(permissionKey(projectId, extensionId), permission),
    // A refused grant usually means the source changed, so show what it requests now.
    onError: () => queryClient.invalidateQueries({ queryKey: permissionKey(projectId, extensionId) }),
  });
};

export const useRevokeExtensionProcessEnvironment = (projectId: string, extensionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getApiClient().extensions.processEnvironment.revoke(projectId, extensionId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: permissionKey(projectId, extensionId) }),
  });
};
