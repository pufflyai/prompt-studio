import { describe, expect, test } from "bun:test";
import { parseOpencodeModels } from "./models";

describe("parseOpencodeModels", () => {
  test("maps verbose model blocks and their variants", () => {
    const output = `opencode/fable
{
  "id": "fable",
  "providerID": "opencode",
  "name": "Fable",
  "variants": { "low": {}, "high": {} }
}
opencode/pickle
{
  "id": "pickle",
  "providerID": "opencode",
  "name": "Big Pickle",
  "variants": {}
}`;

    expect(parseOpencodeModels(output)).toEqual([
      {
        id: "opencode/fable",
        label: "Fable",
        paramOverrides: {
          variant: {
            type: "select",
            label: "Thinking",
            defaultValue: "default",
            options: [
              { label: "Default", value: "default", icon: "Sparkles" },
              { label: "Low", value: "low", icon: "Gauge" },
              { label: "High", value: "high", icon: "Zap" },
            ],
          },
        },
      },
      { id: "opencode/pickle", label: "Big Pickle", paramOverrides: { variant: null } },
    ]);
  });

  test("keeps plain model output compatible", () => {
    expect(parseOpencodeModels("openai/gpt-5\nanthropic/claude-sonnet\n")).toEqual([
      { id: "openai/gpt-5" },
      { id: "anthropic/claude-sonnet" },
    ]);
  });
});
