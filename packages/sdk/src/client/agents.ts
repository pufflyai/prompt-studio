import type { SetupAgentInput, UpdateAgentInput } from "../api/agents";
import type { AgentConfig, AgentInfo } from "../resources";
import type { RequestFn } from "./request";

export type AgentClient = {
  list(): Promise<AgentConfig[]>;
  info(): Promise<AgentInfo[]>;
  setup(input: SetupAgentInput): Promise<AgentConfig>;
  update(agentId: string, input: UpdateAgentInput): Promise<AgentConfig>;
  delete(agentId: string): Promise<void>;
};

export const createAgentClient = (request: RequestFn): AgentClient => ({
  list: () => request("/v1/agents"),
  info: () => request("/v1/agents/info"),
  setup: (input) => request("/v1/agents", { method: "POST", body: input }),
  update: (agentId, input) => request(`/v1/agents/${agentId}`, { method: "PATCH", body: input }),
  delete: (agentId) => request(`/v1/agents/${agentId}`, { method: "DELETE" }),
});
