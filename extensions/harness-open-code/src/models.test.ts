import { describe, expect, test } from "bun:test";
import { parseOpencodeModels } from "./models";

describe("parseOpencodeModels", () => {
  test("keeps provider-qualified labels and selects a supported thinking level", () => {
    const output = `opencode/gpt-5.5
{
  "id": "gpt-5.5",
  "providerID": "opencode",
  "name": "GPT-5.5",
  "cost": { "input": 1, "output": 2 },
  "variants": { "default": {}, "low": {}, "medium": {}, "high": {} }
}
openai/gpt-5.5
{
  "id": "gpt-5.5",
  "providerID": "openai",
  "name": "GPT-5.5",
  "variants": { "low": {}, "high": {} }
}`;

    expect(parseOpencodeModels(output)).toEqual([
      {
        id: "opencode/gpt-5.5",
        label: "opencode/gpt-5.5",
        paramOverrides: {
          variant: {
            type: "select",
            label: "Thinking",
            defaultValue: "medium",
            options: [
              { label: "Low", value: "low", icon: "Gauge" },
              { label: "Medium", value: "medium", icon: "Brain" },
              { label: "High", value: "high", icon: "Zap" },
            ],
          },
        },
      },
      {
        id: "openai/gpt-5.5",
        label: "openai/gpt-5.5",
        paramOverrides: {
          variant: {
            type: "select",
            label: "Thinking",
            defaultValue: "low",
            options: [
              { label: "Low", value: "low", icon: "Gauge" },
              { label: "High", value: "high", icon: "Zap" },
            ],
          },
        },
      },
    ]);
  });

  test("keeps plain model output compatible", () => {
    expect(parseOpencodeModels("openai/gpt-5\nanthropic/claude-sonnet\n")).toEqual([
      { id: "openai/gpt-5" },
      { id: "anthropic/claude-sonnet" },
    ]);
  });
});
