import { describe, expect, test } from "bun:test";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "./resolve-create-session";

const CLAUDE_CODE_ID = testHarnessId("claude-code");
const OPENCODE_ID = testHarnessId("opencode");

const registryWith = (...localIds: string[]) =>
  createTestHarnessRegistry(
    localIds.map((localId) =>
      createTestHarnessRecord(localId, {
        provider: {
          listModels: () => [{ id: `${localId}-default` }, { id: `${localId}-fast` }],
        },
      }),
    ),
  );

describe("resolveCreateSessionAgent", () => {
  test("explicit agent wins when enabled for project", async () => {
    const project = {
      selected_agents: JSON.stringify([CLAUDE_CODE_ID, OPENCODE_ID]),
      default_agent_id: CLAUDE_CODE_ID,
    };
    const result = await resolveCreateSessionAgent(OPENCODE_ID, project, [], registryWith("claude-code", "opencode"));
    expect(result).toEqual({ type: "ok", agentId: OPENCODE_ID });
  });

  test("returns error when explicit agent not enabled for project", async () => {
    const project = { selected_agents: JSON.stringify([OPENCODE_ID]) };
    const result = await resolveCreateSessionAgent(
      CLAUDE_CODE_ID,
      project,
      [],
      registryWith("opencode", "claude-code"),
    );
    expect(result.type).toBe("error");
  });

  test("project default wins when set and registered and allowed", async () => {
    const project = { selected_agents: "[]", default_agent_id: CLAUDE_CODE_ID };
    const configured = [{ agent_id: OPENCODE_ID, is_default: true }];
    const result = await resolveCreateSessionAgent(
      undefined,
      project,
      configured,
      registryWith("claude-code", "opencode"),
    );
    expect(result).toEqual({ type: "ok", agentId: CLAUDE_CODE_ID });
  });

  test("falls back to global default when project default not registered", async () => {
    const project = { selected_agents: "[]", default_agent_id: "deleted-agent" };
    const configured = [{ agent_id: OPENCODE_ID, is_default: true }];
    const result = await resolveCreateSessionAgent(undefined, project, configured, registryWith("opencode"));
    expect(result).toEqual({ type: "ok", agentId: OPENCODE_ID });
  });

  test("falls back to global default when project default not in selected_agents", async () => {
    const project = { selected_agents: JSON.stringify([OPENCODE_ID]), default_agent_id: CLAUDE_CODE_ID };
    const configured = [
      { agent_id: CLAUDE_CODE_ID, is_default: true },
      { agent_id: OPENCODE_ID, is_default: false },
    ];
    const result = await resolveCreateSessionAgent(
      undefined,
      project,
      configured,
      registryWith("claude-code", "opencode"),
    );
    expect(result).toEqual({ type: "ok", agentId: OPENCODE_ID });
  });

  test("falls back to global is_default when no project default set", async () => {
    const project = { selected_agents: "[]", default_agent_id: null };
    const configured = [
      { agent_id: OPENCODE_ID, is_default: false },
      { agent_id: CLAUDE_CODE_ID, is_default: true },
    ];
    const result = await resolveCreateSessionAgent(
      undefined,
      project,
      configured,
      registryWith("claude-code", "opencode"),
    );
    expect(result).toEqual({ type: "ok", agentId: CLAUDE_CODE_ID });
  });

  test("returns undefined agent when nothing configured", async () => {
    const project = { selected_agents: "[]" };
    const result = await resolveCreateSessionAgent(undefined, project, [], registryWith());
    expect(result).toEqual({ type: "ok", agentId: undefined });
  });
});

describe("resolveCreateSessionModel", () => {
  test("explicit model wins", async () => {
    const project = { default_agent_id: CLAUDE_CODE_ID, default_agent_model: "claude-3-5-sonnet" };
    const result = await resolveCreateSessionModel("opus", project, CLAUDE_CODE_ID, registryWith("claude-code"), {
      requestAgentWasOmitted: false,
    });
    expect(result).toBe("opus");
  });

  test("returns project default model when request omitted agent and default is valid", async () => {
    const project = { default_agent_id: CLAUDE_CODE_ID, default_agent_model: "claude-code-fast" };
    const result = await resolveCreateSessionModel(undefined, project, CLAUDE_CODE_ID, registryWith("claude-code"), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBe("claude-code-fast");
  });

  test("does not use project default model when request provided an explicit agent", async () => {
    const project = { default_agent_id: CLAUDE_CODE_ID, default_agent_model: "claude-code-fast" };
    const result = await resolveCreateSessionModel(undefined, project, CLAUDE_CODE_ID, registryWith("claude-code"), {
      requestAgentWasOmitted: false,
    });
    expect(result).toBeUndefined();
  });

  test("falls back to first model when request omitted agent and project default model is stale", async () => {
    const project = { default_agent_id: CLAUDE_CODE_ID, default_agent_model: "deprecated-model" };
    const result = await resolveCreateSessionModel(undefined, project, CLAUDE_CODE_ID, registryWith("claude-code"), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBe("claude-code-default");
  });

  test("returns undefined when no project default model set", async () => {
    const project = { default_agent_id: CLAUDE_CODE_ID, default_agent_model: null };
    const result = await resolveCreateSessionModel(undefined, project, CLAUDE_CODE_ID, registryWith("claude-code"), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBeUndefined();
  });

  test("returns undefined when resolved agent differs from project default agent", async () => {
    const project = { default_agent_id: CLAUDE_CODE_ID, default_agent_model: "claude-code-default" };
    const result = await resolveCreateSessionModel(
      undefined,
      project,
      OPENCODE_ID,
      registryWith("claude-code", "opencode"),
      {
        requestAgentWasOmitted: true,
      },
    );
    expect(result).toBeUndefined();
  });

  test("returns undefined when resolved agent not registered", async () => {
    const project = { default_agent_id: "ghost", default_agent_model: "any" };
    const result = await resolveCreateSessionModel(undefined, project, "ghost", registryWith(), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBeUndefined();
  });
});
