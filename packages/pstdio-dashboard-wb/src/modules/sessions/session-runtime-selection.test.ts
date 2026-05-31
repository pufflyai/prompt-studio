import { describe, expect, test } from "bun:test";
import {
  resolveRuntimeAgentSelection,
  resolveRuntimeBranchSelection,
  resolveRuntimeModelSelection,
  resolveRuntimeRepositorySelection,
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

  test("keeps a valid selected model before falling back to the preferred model", () => {
    expect(
      resolveRuntimeModelSelection({
        models: [{ id: "model-a" }, { id: "model-b" }],
        selectedModel: "model-b",
        preferredModel: "model-a",
      }),
    ).toBe("model-b");
  });

  test("resolves repository selection from live project repositories", () => {
    expect(
      resolveRuntimeRepositorySelection({
        repositories: [{ id: "repo-1" }, { id: "repo-2" }],
        selectedRepository: "repo-missing",
      }),
    ).toBe("repo-1");
  });

  test("uses locked workspace branch before repo branch defaults", () => {
    expect(
      resolveRuntimeBranchSelection({
        branches: [
          { name: "main", isCurrent: true },
          { name: "feature/dashboard", isCurrent: false },
        ],
        selectedBranch: "",
        lockedBranch: "workspace/PS-307_A1",
      }),
    ).toBe("workspace/PS-307_A1");
  });

  test("uses the current repo branch when there is no explicit branch selection", () => {
    expect(
      resolveRuntimeBranchSelection({
        branches: [
          { name: "feature/dashboard", isCurrent: false },
          { name: "main", isCurrent: true },
        ],
        selectedBranch: "",
        lockedBranch: null,
      }),
    ).toBe("main");
  });
});
