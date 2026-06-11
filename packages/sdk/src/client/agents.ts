import type { AgentModel } from "pstdio-api-contracts";
import type { AgentInfo } from "../resources";
import type { RequestFn } from "./request";

export type AgentClient = {
  info(): Promise<AgentInfo[]>;
  models(agentId: string): Promise<AgentModel[]>;
};

export const createAgentClient = (request: RequestFn): AgentClient => ({
  info: () => request("/v1/agents/info"),
  models: (agentId) => request(`/v1/agents/${agentId}/models`),
});
