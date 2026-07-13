import { describe, expect, test } from "bun:test";
import { parseClaudeModels } from "./models";

describe("parseClaudeModels", () => {
  test("removes thinking for unsupported models and preserves per-model effort levels", () => {
    expect(
      parseClaudeModels({
        models: [
          {
            value: "default",
            displayName: "Default (recommended)",
            description: "Opus 4.7 with 1M context",
            supportsEffort: true,
            supportedEffortLevels: ["low", "medium", "high", "xhigh"],
          },
          {
            value: "sonnet",
            displayName: "Sonnet",
            description: "Balanced",
            supportsEffort: true,
            supportedEffortLevels: ["low", "medium", "high"],
          },
          { value: "haiku", displayName: "Haiku", supportsEffort: false },
          {
            value: "claude-fable-5[1m]",
            displayName: "claude-fable-5[1m]",
            description: "Custom model",
            supportsEffort: true,
            supportedEffortLevels: ["low", "high"],
          },
        ],
      }),
    ).toEqual([
      {
        id: "opus",
        label: "Opus",
        description: "Opus 4.7 with 1M context",
        isDefault: true,
        paramOverrides: {
          thinking: {
            type: "select",
            label: "Thinking",
            defaultValue: "high",
            options: [
              { label: "Low", value: "low", icon: "Gauge" },
              { label: "Medium", value: "medium", icon: "Brain" },
              { label: "High", value: "high", icon: "Zap" },
              { label: "XHigh", value: "xhigh", icon: "Flame" },
            ],
          },
        },
      },
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
      {
        id: "claude-fable-5[1m]",
        label: "Fable",
        description: "Custom model",
        paramOverrides: {
          thinking: {
            type: "select",
            label: "Thinking",
            defaultValue: "high",
            options: [
              { label: "Low", value: "low", icon: "Gauge" },
              { label: "High", value: "high", icon: "Zap" },
            ],
          },
        },
      },
    ]);
  });
});
