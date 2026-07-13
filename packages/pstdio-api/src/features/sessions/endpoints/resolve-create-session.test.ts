import { describe, expect, test } from "bun:test";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "./resolve-create-session";

const CLAUDE_CODE_ID = testHarnessId("claude-code");
const OPENCODE_ID = testHarnessId("opencode");
const PROJECT_ID = "project-1";

const registryWith = (localIds: string[], disabledForProject: string[] = []) =>
  createTestHarnessRegistry(
    localIds.map((localId) =>
      createTestHarnessRecord(localId, {
        provider: {
          listModels: () => [{ id: `${localId}-default`, isDefault: true }, { id: `${localId}-fast` }],
        },
      }),
    ),
    { disabledByProject: { [PROJECT_ID]: disabledForProject } },
  );

describe("resolveCreateSessionAgent", () => {
  test("explicit agent wins when its extension is enabled for the project", async () => {
    const project = { id: PROJECT_ID, default_agent_id: CLAUDE_CODE_ID };
    const result = await resolveCreateSessionAgent(OPENCODE_ID, project, registryWith(["claude-code", "opencode"]));
    expect(result).toEqual({ type: "ok", agentId: OPENCODE_ID });
  });

  test("returns error when the explicit agent's extension is disabled for the project", async () => {
    const project = { id: PROJECT_ID };
    const result = await resolveCreateSessionAgent(
      CLAUDE_CODE_ID,
      project,
      registryWith(["opencode", "claude-code"], [CLAUDE_CODE_ID]),
    );
    expect(result.type).toBe("error");
  });

  test("returns error for an unknown explicit agent", async () => {
    const result = await resolveCreateSessionAgent("missing-agent", { id: PROJECT_ID }, registryWith(["opencode"]));
    expect(result.type).toBe("error");
  });

  test("project default wins when set and enabled", async () => {
    const project = { id: PROJECT_ID, default_agent_id: CLAUDE_CODE_ID };
    const result = await resolveCreateSessionAgent(undefined, project, registryWith(["claude-code", "opencode"]));
    expect(result).toEqual({ type: "ok", agentId: CLAUDE_CODE_ID });
  });

  test("falls back to the first available harness when the project default is not registered", async () => {
    const project = { id: PROJECT_ID, default_agent_id: "deleted-agent" };
    const result = await resolveCreateSessionAgent(undefined, project, registryWith(["opencode"]));
    expect(result).toEqual({ type: "ok", agentId: OPENCODE_ID });
  });

  test("skips harnesses whose extension is disabled for the project when falling back", async () => {
    const project = { id: PROJECT_ID };
    const result = await resolveCreateSessionAgent(
      undefined,
      project,
      registryWith(["claude-code", "opencode"], [CLAUDE_CODE_ID]),
    );
    expect(result).toEqual({ type: "ok", agentId: OPENCODE_ID });
  });

  test("resolves undefined when no harness is available", async () => {
    const result = await resolveCreateSessionAgent(
      undefined,
      { id: PROJECT_ID },
      registryWith(["opencode"], [OPENCODE_ID]),
    );
    expect(result).toEqual({ type: "ok", agentId: undefined });
  });
});

describe("resolveCreateSessionModel", () => {
  test("explicit model wins", async () => {
    const result = await resolveCreateSessionModel("my-model", null, OPENCODE_ID, registryWith(["opencode"]), {
      requestAgentWasOmitted: false,
    });
    expect(result).toBe("my-model");
  });

  test("uses the catalog default model when the request named an agent", async () => {
    const project = { id: PROJECT_ID, default_agent_id: OPENCODE_ID, default_agent_model: "opencode-fast" };
    const result = await resolveCreateSessionModel(undefined, project, OPENCODE_ID, registryWith(["opencode"]), {
      requestAgentWasOmitted: false,
    });
    expect(result).toBe("opencode-default");
  });

  test("uses the project default model when it exists for the resolved default agent", async () => {
    const project = { id: PROJECT_ID, default_agent_id: OPENCODE_ID, default_agent_model: "opencode-fast" };
    const result = await resolveCreateSessionModel(undefined, project, OPENCODE_ID, registryWith(["opencode"]), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBe("opencode-fast");
  });

  test("uses the catalog default when the stored default model is unknown", async () => {
    const project = { id: PROJECT_ID, default_agent_id: OPENCODE_ID, default_agent_model: "gone" };
    const result = await resolveCreateSessionModel(undefined, project, OPENCODE_ID, registryWith(["opencode"]), {
      requestAgentWasOmitted: true,
    });
    expect(result).toBe("opencode-default");
  });
});
