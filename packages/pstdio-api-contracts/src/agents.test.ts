import { describe, expect, test } from "bun:test";
import { agentInfoSchema } from "./agents";

describe("agentInfoSchema", () => {
  test("preserves optional select option icons", () => {
    const parsed = agentInfoSchema.parse({
      id: "codex",
      name: "Codex",
      availability: { type: "INSTALLED" },
      params: {
        model_reasoning_effort: {
          type: "select",
          label: "Reasoning effort",
          defaultValue: "medium",
          options: [{ label: "Medium", value: "medium", icon: "Brain" }],
        },
      },
    });

    expect(parsed.params?.model_reasoning_effort).toMatchObject({
      options: [{ label: "Medium", value: "medium", icon: "Brain" }],
    });
  });
});
