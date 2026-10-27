import type {
  AgentDetails,
  AgentModel,
  HarnessAuthentication,
  HarnessAuthenticationInput,
  HarnessParams,
  HarnessParamsInfo,
  Page,
  PageQuery,
} from "pstdio-api-contracts";
import type { AgentInfo } from "../resources";
import { type AgentAuthenticationOptions, authenticateAgent } from "./agent-authentication";
import { projectPageQuery } from "./page-query";
import type { ClientOptions, RequestFn } from "./request";

export type AgentClient = {
  authentication(
    agentId: string,
    options?: { projectId?: string; model?: string },
  ): Promise<HarnessAuthentication | null>;
  authenticate(agentId: string, input: HarnessAuthenticationInput, options?: AgentAuthenticationOptions): Promise<void>;
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

export const createAgentClient = (request: RequestFn, options: ClientOptions = {}): AgentClient => ({
  authentication: (agentId, input = {}) => {
    const q = new URLSearchParams();
    if (input.projectId) q.set("projectId", input.projectId);
    if (input.model) q.set("model", input.model);
    return request(`/v1/agents/${encodeURIComponent(agentId)}/authentication?${q}`);
  },
  authenticate: (agentId, input, handlers) => authenticateAgent(options, agentId, input, handlers),
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
