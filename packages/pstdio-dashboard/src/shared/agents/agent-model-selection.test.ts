import { describe, expect, test } from "bun:test";
import { resolveSynchronizedModel } from "./agent-model-selection";

describe("resolveSynchronizedModel", () => {
  test("keeps the stored model while the models query has no data yet (disabled or fetching)", () => {
    // Regression: while agents load, the models query is disabled. A disabled
    // query reports isLoading=false but isPending=true — it must not be read
    // as "this agent has zero models" and wipe the stored selection on mount.
    expect(
      resolveSynchronizedModel({
        currentAgent: "pstdio.harness-open-code.harness.opencode",
        currentModel: "openai/gpt-5.5",
        modelsQuery: { isPending: true, data: undefined },
        modelHistory: [],
      }),
    ).toBeUndefined();
  });

  test("clears the stored model once the agent is known to have no models", () => {
    expect(
      resolveSynchronizedModel({
        currentAgent: "pstdio.harness-open-code.harness.opencode",
        currentModel: "openai/gpt-5.5",
        modelsQuery: { isPending: false, data: [] },
        modelHistory: [],
      }),
    ).toBe("");
  });

  test("clears the stored model when no agent is selected", () => {
    expect(
      resolveSynchronizedModel({
        currentAgent: null,
        currentModel: "openai/gpt-5.5",
        modelsQuery: { isPending: true, data: undefined },
        modelHistory: [],
      }),
    ).toBe("");
  });

  test("keeps the current model when the agent offers it", () => {
    expect(
      resolveSynchronizedModel({
        currentAgent: "pstdio.harness-open-code.harness.opencode",
        currentModel: "openai/gpt-5.5",
        modelsQuery: { isPending: false, data: [{ id: "openai/gpt-5.5" }] },
        modelHistory: [],
      }),
    ).toBeUndefined();
  });

  test("falls back to a remembered model, then a concrete catalog default", () => {
    expect(
      resolveSynchronizedModel({
        currentAgent: "pstdio.harness-open-code.harness.opencode",
        currentModel: "openai/gpt-5.5",
        modelsQuery: {
          isPending: false,
          data: [{ id: "claude-fable-5" }, { id: "claude-haiku-4-5", isDefault: true }],
        },
        modelHistory: ["claude-haiku-4-5"],
      }),
    ).toBe("claude-haiku-4-5");

    expect(
      resolveSynchronizedModel({
        currentAgent: "pstdio.harness-open-code.harness.opencode",
        currentModel: "openai/gpt-5.5",
        modelsQuery: {
          isPending: false,
          data: [{ id: "claude-fable-5" }, { id: "claude-haiku-4-5", isDefault: true }],
        },
        modelHistory: [],
      }),
    ).toBe("claude-haiku-4-5");
  });

  test("uses the first model when the catalog does not mark a default", () => {
    expect(
      resolveSynchronizedModel({
        currentAgent: "pstdio.harness-open-code.harness.opencode",
        currentModel: "gone",
        modelsQuery: { isPending: false, data: [{ id: "first" }, { id: "second" }] },
        modelHistory: [],
      }),
    ).toBe("first");
  });
});
