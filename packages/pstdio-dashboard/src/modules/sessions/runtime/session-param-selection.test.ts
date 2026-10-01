import { describe, expect, test } from "bun:test";
import { resolveSessionSelectionSync } from "./session-runtime-selection";

describe("session harness parameter selection", () => {
  const previous = {
    agent: "codex",
    lastSelectedModel: "gpt-5",
    workspaceId: null,
    params: { model_reasoning_effort: "high" },
  };

  test("restores the destination session's saved parameters", () => {
    expect(
      resolveSessionSelectionSync({
        isViewSwitch: true,
        isPreviousViewDraft: false,
        previous,
        view: { ...previous, params: { model_reasoning_effort: "low" } },
      }),
    ).toEqual({ agent: "codex", model: "gpt-5", workspaceId: "", params: { model_reasoning_effort: "low" } });
  });

  test("keeps an unsent pick when a refreshed session has equal parameters", () => {
    expect(
      resolveSessionSelectionSync({
        isViewSwitch: false,
        isPreviousViewDraft: false,
        previous,
        view: { ...previous, params: { ...previous.params } },
      }),
    ).toEqual({});
  });

  test("adopts parameters changed by the server", () => {
    expect(
      resolveSessionSelectionSync({
        isViewSwitch: false,
        isPreviousViewDraft: false,
        previous,
        view: { ...previous, params: { model_reasoning_effort: "low" } },
      }),
    ).toEqual({ params: { model_reasoning_effort: "low" } });
  });
});
