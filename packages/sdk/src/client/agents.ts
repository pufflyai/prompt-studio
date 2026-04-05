import type { AgentModel, SetupAgentInput, SetupAvailableAgentsInput, UpdateAgentInput } from "pstdio-api-contracts";
import type { AgentConfig, AgentInfo } from "../resources";
import type { RequestFn } from "./request";

export type AgentClient = {
  list(): Promise<AgentConfig[]>;
  info(): Promise<AgentInfo[]>;
  models(agentId: string): Promise<AgentModel[]>;
  setup(input: SetupAgentInput): Promise<AgentConfig>;
  setupAvailable(input: SetupAvailableAgentsInput): Promise<AgentConfig[]>;
  update(agentId: string, input: UpdateAgentInput): Promise<AgentConfig>;
  delete(agentId: string): Promise<void>;
};

export const createAgentClient = (request: RequestFn): AgentClient => ({
  list: () => request("/v1/agents"),
  info: () => request("/v1/agents/info"),
  models: (agentId) => request(`/v1/agents/${agentId}/models`),
  setup: (input) => request("/v1/agents", { method: "POST", body: input }),
  setupAvailable: (input) => request("/v1/agents/setup-available", { method: "POST", body: input }),
  update: (agentId, input) => request(`/v1/agents/${agentId}`, { method: "PATCH", body: input }),
  delete: (agentId) => request(`/v1/agents/${agentId}`, { method: "DELETE" }),
});
