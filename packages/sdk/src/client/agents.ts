import type { AgentDetails, AgentModel, HarnessParams, HarnessParamsInfo, Page, PageQuery } from "pstdio-api-contracts";
import type { AgentInfo } from "../resources";
import { projectPageQuery } from "./page-query";
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
  query(projectId?: string, input?: PageQuery): Promise<Page<AgentDetails>>;
  queryModels(projectId: string | undefined, agentId: string, input?: PageQuery): Promise<Page<AgentModel>>;
  /** @deprecated Use query with projectId as the first argument. */
  info(params?: { project?: string }): Promise<AgentInfo[]>;
  /** @deprecated Use queryModels with projectId first. */
  models(agentId: string, projectId?: string): Promise<AgentModel[]>;
};

export const createAgentClient = (request: RequestFn): AgentClient => ({
  query: (projectId, input) => request(`/v1/agents/query${projectPageQuery(projectId, input)}`),
  queryModels: (projectId, agentId, input) =>
    request(`/v1/agents/${encodeURIComponent(agentId)}/models/query${projectPageQuery(projectId, input)}`),
  info: (params) =>
    request(params?.project ? `/v1/agents/info?projectId=${encodeURIComponent(params.project)}` : "/v1/agents/info"),
  models: (agentId, projectId) =>
    request(
      `/v1/agents/${encodeURIComponent(agentId)}/models${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
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
