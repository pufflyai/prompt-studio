import { describe, expect, test } from "bun:test";
import { parseClaudeModels } from "./models";

describe("parseClaudeModels", () => {
  test("removes thinking for unsupported models and preserves per-model effort levels", () => {
    expect(
      parseClaudeModels({
        models: [
          {
            value: "sonnet",
            displayName: "Sonnet",
            description: "Balanced",
            supportsEffort: true,
            supportedEffortLevels: ["low", "medium", "high"],
          },
          { value: "haiku", displayName: "Haiku", supportsEffort: false },
        ],
      }),
    ).toEqual([
      {
        id: "sonnet",
        label: "Sonnet",
        description: "Balanced",
        paramOverrides: {
          thinking: {
            type: "select",
            label: "Thinking",
            defaultValue: "high",
            options: [
              { label: "Low", value: "low", icon: "Gauge" },
              { label: "Medium", value: "medium", icon: "Brain" },
              { label: "High", value: "high", icon: "Zap" },
            ],
          },
        },
      },
      { id: "haiku", label: "Haiku", paramOverrides: { thinking: null } },
    ]);
  });
});
