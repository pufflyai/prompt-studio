import { describe, expect, test } from "bun:test";
import {
  resolveRuntimeAgentSelection,
  resolveRuntimeModelSelection,
  resolveRuntimeWorkspaceSelection,
  resolveSessionSelectionSync,
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

  test("uses a concrete catalog default when neither selected nor preferred model is available", () => {
    expect(
      resolveRuntimeModelSelection({
        models: [{ id: "model-a" }, { id: "model-b", isDefault: true }],
        selectedModel: "gone",
        preferredModel: "also-gone",
      }),
    ).toBe("model-b");
  });

  test("uses the first model when the catalog does not mark a default", () => {
    expect(
      resolveRuntimeModelSelection({
        models: [{ id: "model-a" }, { id: "model-b" }],
        selectedModel: "gone",
        preferredModel: "also-gone",
      }),
    ).toBe("model-a");
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

describe("resolveRuntimeModelSelection with unknown model lists", () => {
  test("keeps the user's selection while the agent's models are unknown", () => {
    expect(
      resolveRuntimeModelSelection({
        models: [],
        selectedModel: "model-b",
        preferredModel: "model-a",
      }),
    ).toBe("model-b");
  });
});

describe("resolveSessionSelectionSync", () => {
  const draftView = { agent: null, lastSelectedModel: null, workspaceId: null };

  test("keeps the user's picks across draft view refreshes", () => {
    expect(
      resolveSessionSelectionSync({
        isViewSwitch: false,
        isPreviousViewDraft: true,
        previous: draftView,
        view: draftView,
      }),
    ).toEqual({});
  });

  test("adopts backend values when a draft becomes the created session", () => {
    expect(
      resolveSessionSelectionSync({
        isViewSwitch: true,
        isPreviousViewDraft: true,
        previous: draftView,
        view: { agent: "agent-a", lastSelectedModel: "model-b", workspaceId: "ws-1" },
      }),
    ).toEqual({ agent: "agent-a", model: "model-b", workspaceId: "ws-1" });
  });

  test("keeps the user's picks when the created session has not synced yet", () => {
    expect(
      resolveSessionSelectionSync({
        isViewSwitch: true,
        isPreviousViewDraft: true,
        previous: draftView,
        view: draftView,
      }),
    ).toEqual({});
  });

  test("does not clobber an unsent model pick when an unrelated view field changes", () => {
    expect(
      resolveSessionSelectionSync({
        isViewSwitch: false,
        isPreviousViewDraft: false,
        previous: { agent: "agent-a", lastSelectedModel: "model-a", workspaceId: null },
        view: { agent: "agent-a", lastSelectedModel: "model-a", workspaceId: "ws-1" },
      }),
    ).toEqual({ workspaceId: "ws-1" });
  });

  test("adopts a persisted model change on the same session", () => {
    expect(
      resolveSessionSelectionSync({
        isViewSwitch: false,
        isPreviousViewDraft: false,
        previous: { agent: "agent-a", lastSelectedModel: "model-a", workspaceId: "ws-1" },
        view: { agent: "agent-a", lastSelectedModel: "model-b", workspaceId: "ws-1" },
      }),
    ).toEqual({ model: "model-b" });
  });

  test("resets all selections when switching to a different session", () => {
    expect(
      resolveSessionSelectionSync({
        isViewSwitch: true,
        isPreviousViewDraft: false,
        previous: { agent: "agent-a", lastSelectedModel: "model-a", workspaceId: "ws-1" },
        view: { agent: "agent-b", lastSelectedModel: null, workspaceId: null },
      }),
    ).toEqual({ agent: "agent-b", model: "", workspaceId: "" });
  });
});
