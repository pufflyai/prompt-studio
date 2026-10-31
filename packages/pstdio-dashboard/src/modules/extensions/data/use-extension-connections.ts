import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkExtensionConnection,
  configureExtensionConnection,
  deleteExtensionConnection,
  listExtensionConnections,
} from "./extension-connections-api";

const connectionsKey = (projectId: string) => ["extension-connections", projectId] as const;

export const useExtensionConnections = (projectId: string) =>
  useQuery({
    queryKey: connectionsKey(projectId),
    queryFn: () => listExtensionConnections(projectId),
  });

export const useConfigureExtensionConnection = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { extensionId: string; connectionId: string; baseUrl: string; secret?: string }) =>
      configureExtensionConnection(projectId, input.extensionId, input.connectionId, {
        baseUrl: input.baseUrl,
        secret: input.secret,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) }),
  });
};

export const useCheckExtensionConnection = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { extensionId: string; connectionId: string }) =>
      checkExtensionConnection(projectId, input.extensionId, input.connectionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) }),
  });
};

export const useDeleteExtensionConnection = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { extensionId: string; connectionId: string }) =>
      deleteExtensionConnection(projectId, input.extensionId, input.connectionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) }),
  });
};
