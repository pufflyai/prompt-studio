import { describe, expect, test } from "bun:test";
import { resolveSessionSelectionSync } from "./session-runtime-selection";

describe("session harness parameter selection", () => {
  const previous = {
    agent: "codex",
    lastSelectedModel: "gpt-5",
    workspaceId: null,
    params: { model_reasoning_effort: "high" },
  };

  test("keeps an unsent pick when a refreshed session has equal parameters", () => {
    expect(resolveSessionSelectionSync(previous, { ...previous, params: { ...previous.params } })).toEqual({});
  });

  test("adopts parameters changed by the server", () => {
    expect(resolveSessionSelectionSync(previous, { ...previous, params: { model_reasoning_effort: "low" } })).toEqual({
      params: { model_reasoning_effort: "low" },
    });
  });
});
