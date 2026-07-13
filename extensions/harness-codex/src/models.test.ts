import { describe, expect, test } from "bun:test";
import { parseCodexModels } from "./models";

describe("parseCodexModels", () => {
  test("maps catalog metadata and each model's supported reasoning efforts", () => {
    expect(
      parseCodexModels({
        data: [
          {
            id: "gpt-large",
            displayName: "GPT Large",
            description: "Deep reasoning",
            isDefault: true,
            supportedReasoningEfforts: [{ reasoningEffort: "low" }, { reasoningEffort: "high" }],
            defaultReasoningEffort: "high",
          },
          { id: "gpt-fast", displayName: "GPT Fast", supportedReasoningEfforts: [] },
        ],
      }),
    ).toEqual([
      {
        id: "gpt-large",
        label: "GPT Large",
        description: "Deep reasoning",
        isDefault: true,
        paramOverrides: {
          model_reasoning_effort: {
            type: "select",
            label: "Reasoning effort",
            defaultValue: "high",
            options: [
              { label: "Low", value: "low", icon: "Gauge" },
              { label: "High", value: "high", icon: "Zap" },
            ],
          },
        },
      },
      {
        id: "gpt-fast",
        label: "GPT Fast",
        paramOverrides: { model_reasoning_effort: null },
      },
    ]);
  });
});
