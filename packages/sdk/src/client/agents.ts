import type { AgentModel, HarnessParams, HarnessParamsInfo } from "pstdio-api-contracts";
import type { AgentInfo } from "../resources";
import type { RequestFn } from "./request";

export type AgentClient = {
  getParamDefaults(
    projectId: string,
    agentId: string,
    model?: string,
  ): Promise<{ schema: HarnessParamsInfo | null; defaults: HarnessParams }>;
  setParamDefaults(
    projectId: string,
    agentId: string,
    params: HarnessParams,
  ): Promise<{ schema: HarnessParamsInfo | null; defaults: HarnessParams }>;
  info(params?: { project?: string }): Promise<AgentInfo[]>;
  models(agentId: string, projectId?: string): Promise<AgentModel[]>;
};

export const createAgentClient = (request: RequestFn): AgentClient => ({
  info: (params) =>
    request(params?.project ? `/v1/agents/info?project=${encodeURIComponent(params.project)}` : "/v1/agents/info"),
  models: (agentId, projectId) =>
    request(
      `/v1/agents/${encodeURIComponent(agentId)}/models${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`,
    ),
  getParamDefaults: (projectId, agentId, model) =>
    request(
      `/v1/projects/${encodeURIComponent(projectId)}/harnesses/${encodeURIComponent(agentId)}/params${model ? `?model=${encodeURIComponent(model)}` : ""}`,
    ),
  setParamDefaults: (projectId, agentId, params) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/harnesses/${encodeURIComponent(agentId)}/params`, {
      method: "PUT",
      body: { params },
    }),
});
