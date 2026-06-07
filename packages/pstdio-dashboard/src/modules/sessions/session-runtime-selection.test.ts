import { describe, expect, test } from "bun:test";
import {
  resolveRuntimeAgentSelection,
  resolveRuntimeModelSelection,
  resolveRuntimeWorkspaceSelection,
} from "@/modules/sessions/runtime/session-runtime-selection";

describe("session runtime selection", () => {
  test("keeps an existing session agent even when project defaults differ", () => {
    expect(
      resolveRuntimeAgentSelection({
        agentOptions: [
          { value: "opencode", disabled: false },
          { value: "claude-code", disabled: false },
        ],
        selectedAgent: "opencode",
        sessionAgent: "claude-code",
        defaultAgent: "opencode",
      }),
    ).toBe("claude-code");
  });

  test("prefers the project default agent before falling back to the first enabled agent", () => {
    expect(
      resolveRuntimeAgentSelection({
        agentOptions: [
          { value: "opencode", disabled: false },
          { value: "claude-code", disabled: false },
        ],
        selectedAgent: "",
        sessionAgent: null,
        defaultAgent: "claude-code",
      }),
    ).toBe("claude-code");
  });

  test("uses the default agent while agent options are still unavailable", () => {
    expect(
      resolveRuntimeAgentSelection({
        agentOptions: [],
        selectedAgent: "",
        sessionAgent: null,
        defaultAgent: "opencode",
      }),
    ).toBe("opencode");
  });

  test("keeps a valid selected model before falling back to the preferred model", () => {
    expect(
      resolveRuntimeModelSelection({
        models: [{ id: "model-a" }, { id: "model-b" }],
        selectedModel: "model-b",
        preferredModel: "model-a",
      }),
    ).toBe("model-b");
  });

  test("keeps a selected workspace when it is still available", () => {
    expect(
      resolveRuntimeWorkspaceSelection({
        workspaces: [{ id: "workspace-1" }, { id: "workspace-2" }],
        selectedWorkspaceId: "workspace-2",
        fallbackWorkspaceId: "workspace-1",
      }),
    ).toBe("workspace-2");
  });

  test("falls back to the linked draft workspace before the newest workspace", () => {
    expect(
      resolveRuntimeWorkspaceSelection({
        workspaces: [{ id: "workspace-1" }, { id: "workspace-2" }],
        selectedWorkspaceId: "workspace-missing",
        fallbackWorkspaceId: "workspace-2",
      }),
    ).toBe("workspace-2");
  });
});
