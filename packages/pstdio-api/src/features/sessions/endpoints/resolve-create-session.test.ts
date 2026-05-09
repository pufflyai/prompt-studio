import { describe, expect, test } from "bun:test";
import type { AgentRegistry } from "pstdio-agents";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "./resolve-create-session";

const registryWith = (...agentIds: string[]) =>
  ({
    get: (id: string) =>
      agentIds.includes(id)
        ? {
            listModels: () => [{ id: `${id}-default` }, { id: `${id}-fast` }],
          }
        : null,
  }) as unknown as AgentRegistry;

describe("resolveCreateSessionAgent", () => {
  test("explicit agent wins when enabled for project", () => {
    const project = { selected_agents: '["claude-code","opencode"]', default_agent_id: "claude-code" };
    const result = resolveCreateSessionAgent("opencode", project, [], registryWith("claude-code", "opencode"));
    expect(result).toEqual({ type: "ok", agentId: "opencode" });
  });

  test("returns error when explicit agent not enabled for project", () => {
    const project = { selected_agents: '["opencode"]' };
    const result = resolveCreateSessionAgent("claude-code", project, [], registryWith("opencode", "claude-code"));
    expect(result.type).toBe("error");
  });

  test("project default wins when set and registered and allowed", () => {
    const project = { selected_agents: "[]", default_agent_id: "claude-code" };
    const configured = [{ agent_id: "opencode", is_default: true }];
    const result = resolveCreateSessionAgent(undefined, project, configured, registryWith("claude-code", "opencode"));
    expect(result).toEqual({ type: "ok", agentId: "claude-code" });
  });

  test("falls back to global default when project default not registered", () => {
    const project = { selected_agents: "[]", default_agent_id: "deleted-agent" };
    const configured = [{ agent_id: "opencode", is_default: true }];
    const result = resolveCreateSessionAgent(undefined, project, configured, registryWith("opencode"));
    expect(result).toEqual({ type: "ok", agentId: "opencode" });
  });

  test("falls back to global default when project default not in selected_agents", () => {
    const project = { selected_agents: '["opencode"]', default_agent_id: "claude-code" };
    const configured = [
      { agent_id: "claude-code", is_default: true },
      { agent_id: "opencode", is_default: false },
    ];
    const result = resolveCreateSessionAgent(undefined, project, configured, registryWith("claude-code", "opencode"));
    expect(result).toEqual({ type: "ok", agentId: "opencode" });
  });

  test("falls back to global is_default when no project default set", () => {
    const project = { selected_agents: "[]", default_agent_id: null };
    const configured = [
      { agent_id: "opencode", is_default: false },
      { agent_id: "claude-code", is_default: true },
    ];
    const result = resolveCreateSessionAgent(undefined, project, configured, registryWith("claude-code", "opencode"));
    expect(result).toEqual({ type: "ok", agentId: "claude-code" });
  });

  test("returns undefined agent when nothing configured", () => {
    const project = { selected_agents: "[]" };
    const result = resolveCreateSessionAgent(undefined, project, [], registryWith());
    expect(result).toEqual({ type: "ok", agentId: undefined });
  });
});

describe("resolveCreateSessionModel", () => {
  test("explicit model wins", () => {
    const project = { default_agent_id: "claude-code", default_agent_model: "claude-3-5-sonnet" };
    const result = resolveCreateSessionModel("opus", project, "claude-code", registryWith("claude-code"), {
      requestAgentWasOmitted: false,
    });
    expect(result).toBe("opus");
  });

  test("returns project default model when request omitted agent and default is valid", () => {
    const project = { default_agent_id: "claude-code", default_agent_model: "claude-code-fast" };
    const result = resolveCreateSessionModel(undefined, project, "claude-code", registryWith("claude-code"), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBe("claude-code-fast");
  });

  test("does not use project default model when request provided an explicit agent", () => {
    const project = { default_agent_id: "claude-code", default_agent_model: "claude-code-fast" };
    const result = resolveCreateSessionModel(undefined, project, "claude-code", registryWith("claude-code"), {
      requestAgentWasOmitted: false,
    });
    expect(result).toBeUndefined();
  });

  test("falls back to first model when request omitted agent and project default model is stale", () => {
    const project = { default_agent_id: "claude-code", default_agent_model: "deprecated-model" };
    const result = resolveCreateSessionModel(undefined, project, "claude-code", registryWith("claude-code"), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBe("claude-code-default");
  });

  test("returns undefined when no project default model set", () => {
    const project = { default_agent_id: "claude-code", default_agent_model: null };
    const result = resolveCreateSessionModel(undefined, project, "claude-code", registryWith("claude-code"), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBeUndefined();
  });

  test("returns undefined when resolved agent differs from project default agent", () => {
    const project = { default_agent_id: "claude-code", default_agent_model: "claude-code-default" };
    const result = resolveCreateSessionModel(undefined, project, "opencode", registryWith("claude-code", "opencode"), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBeUndefined();
  });

  test("returns undefined when resolved agent not registered", () => {
    const project = { default_agent_id: "ghost", default_agent_model: "any" };
    const result = resolveCreateSessionModel(undefined, project, "ghost", registryWith(), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBeUndefined();
  });
});
