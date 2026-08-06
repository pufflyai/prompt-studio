import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HarnessParamsInfo } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";
import type { HarnessParamValues } from "../components/harness-param-values";

export type HarnessParamDefaultsResponse = {
  schema: HarnessParamsInfo | null;
  defaults: HarnessParamValues;
};

const queryKey = (projectId: string | undefined, agentId: string | undefined) => [
  "harness-param-defaults",
  projectId ?? "",
  agentId ?? "",
];

const defaultsPath = (projectId: string, agentId: string) =>
  `/v1/projects/${projectId}/harnesses/${encodeURIComponent(agentId)}/params`;

export const useHarnessParamDefaults = (projectId: string | undefined, agentId: string | undefined) =>
  useQuery({
    queryKey: queryKey(projectId, agentId),
    enabled: Boolean(projectId && agentId),
    queryFn: () => apiRequest<HarnessParamDefaultsResponse>(defaultsPath(projectId!, agentId!)),
  });

export const useUpdateHarnessParamDefaults = (projectId: string | undefined, agentId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: HarnessParamValues) =>
      apiRequest<HarnessParamDefaultsResponse>(defaultsPath(projectId!, agentId!), {
        method: "PUT",
        body: { params },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey(projectId, agentId), data);
    },
  });
};
