import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { checkExtensions, executeExtensionCommand } from "../data/api";

export const extensionsCheckQueryKey = ["extensions", "check"] as const;

export const useExtensionsCheck = () =>
  useQuery({
    queryKey: extensionsCheckQueryKey,
    queryFn: checkExtensions,
  });

export const useExecuteExtensionCommand = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof executeExtensionCommand>) => executeExtensionCommand(...input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: extensionsCheckQueryKey });
    },
  });
};
