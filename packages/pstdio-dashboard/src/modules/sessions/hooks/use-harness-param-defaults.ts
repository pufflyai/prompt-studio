import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HarnessParamsInfo } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";
import type { HarnessParamValues } from "../components/harness-param-values";

export type HarnessParamDefaultsResponse = {
  schema: HarnessParamsInfo | null;
  defaults: HarnessParamValues;
};

const queryKey = (projectId: string | undefined, agentId: string | undefined, model?: string) => [
  "harness-param-defaults",
  projectId ?? "",
  agentId ?? "",
  model ?? "",
];

const defaultsPath = (projectId: string, agentId: string) =>
  `/v1/projects/${projectId}/harnesses/${encodeURIComponent(agentId)}/params`;

export const useHarnessParamDefaults = (projectId: string | undefined, agentId: string | undefined, model?: string) =>
  useQuery({
    queryKey: queryKey(projectId, agentId, model),
    enabled: Boolean(projectId && agentId),
    queryFn: () =>
      apiRequest<HarnessParamDefaultsResponse>(
        `${defaultsPath(projectId!, agentId!)}${model ? `?model=${encodeURIComponent(model)}` : ""}`,
      ),
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
      void queryClient.invalidateQueries({ queryKey: ["harness-param-defaults", projectId ?? "", agentId ?? ""] });
    },
  });
};
