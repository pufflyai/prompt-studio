import type { HarnessParamValues } from "@pstdio/ui/param-editor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

const queryKey = (projectId: string | undefined, agentId: string | undefined, model?: string) => [
  "harness-param-defaults",
  projectId ?? "",
  agentId ?? "",
  model ?? "",
];

export const useHarnessParamDefaults = (projectId: string | undefined, agentId: string | undefined, model?: string) =>
  useQuery({
    queryKey: queryKey(projectId, agentId, model),
    enabled: Boolean(projectId && agentId),
    queryFn: () => getApiClient().agents.getParamDefaults(projectId!, agentId!, model),
  });

export const useUpdateHarnessParamDefaults = (projectId: string | undefined, agentId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: HarnessParamValues) => getApiClient().agents.setParamDefaults(projectId!, agentId!, params),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey(projectId, agentId), data);
      void queryClient.invalidateQueries({ queryKey: ["harness-param-defaults", projectId ?? "", agentId ?? ""] });
    },
  });
};
