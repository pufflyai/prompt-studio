import { describe, expect, test } from "bun:test";
import { getConfiguredAgentModel, resolvePreferredAgentModel } from "@/shared/agent-model-selection";

describe("getConfiguredAgentModel", () => {
  test("returns trimmed model from agent settings", () => {
    expect(getConfiguredAgentModel({ model: "  openai/gpt-5.5  " })).toBe("openai/gpt-5.5");
  });

  test("ignores missing and blank model settings", () => {
    expect(getConfiguredAgentModel({})).toBeUndefined();
    expect(getConfiguredAgentModel({ model: " " })).toBeUndefined();
  });
});

describe("resolvePreferredAgentModel", () => {
  test("uses configured model when no model has been selected manually", () => {
    expect(
      resolvePreferredAgentModel({
        configuredModel: "openai/gpt-5.5",
        modelHistory: [],
      }),
    ).toBe("openai/gpt-5.5");
  });

  test("keeps the manually selected model ahead of the configured default", () => {
    expect(
      resolvePreferredAgentModel({
        configuredModel: "openai/gpt-5.5",
        modelHistory: ["openai/gpt-5.3-codex"],
      }),
    ).toBe("openai/gpt-5.3-codex");
  });
});
