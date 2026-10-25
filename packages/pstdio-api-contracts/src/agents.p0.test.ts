import { describe, expect, test } from "bun:test";
import { agentInfoSchema, agentModelSchema, findAgentModel, resolveAgentModelParams } from "./agents";

describe("agentInfoSchema", () => {
  test("preserves command-owned composer controls without dropping native parameter defaults", () => {
    const parameter = {
      type: "select" as const,
      control: "command" as const,
      defaultValue: "default",
      options: [
        { label: "Default", value: "default" },
        { label: "Plan", value: "plan" },
      ],
    };
    const parsed = agentInfoSchema.parse({
      id: "external",
      name: "External",
      availability: { type: "INSTALLED" },
      params: { mode: parameter },
      capabilities: [],
      supportsModels: true,
    });
    expect(parsed.params?.mode).toEqual(parameter);
  });
  test("preserves optional select option icons", () => {
    const parsed = agentInfoSchema.parse({
      id: "codex",
      name: "Codex",
      availability: { type: "INSTALLED" },
      capabilities: ["Attachments"],
      supportsModels: true,
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

describe("agentModelSchema", () => {
  test("preserves model metadata and parameter overrides", () => {
    const parsed = agentModelSchema.parse({
      id: "claude-haiku",
      label: "Haiku",
      description: "Fast model",
      isDefault: true,
      paramOverrides: { thinking: null },
    });

    expect(parsed).toEqual({
      id: "claude-haiku",
      label: "Haiku",
      description: "Fast model",
      isDefault: true,
      paramOverrides: { thinking: null },
    });
  });
});

describe("resolveAgentModelParams", () => {
  test("replaces and removes harness params using model metadata", () => {
    const base = {
      thinking: {
        type: "select" as const,
        defaultValue: "high",
        options: [{ label: "High", value: "high" }],
      },
      summary: { type: "boolean" as const, defaultValue: true },
    };

    expect(
      resolveAgentModelParams(base, {
        paramOverrides: {
          thinking: {
            type: "select",
            defaultValue: "low",
            options: [{ label: "Low", value: "low" }],
          },
          summary: null,
        },
      }),
    ).toEqual({
      thinking: {
        type: "select",
        defaultValue: "low",
        options: [{ label: "Low", value: "low" }],
      },
    });
  });
});

describe("findAgentModel", () => {
  test("uses catalog default metadata when no explicit model is selected", () => {
    const models = [{ id: "fast" }, { id: "balanced", isDefault: true }];

    expect(findAgentModel(models, undefined)?.id).toBe("balanced");
    expect(findAgentModel(models, "fast")?.id).toBe("fast");
  });

  test("uses the first catalog model when no model is marked as default", () => {
    expect(findAgentModel([{ id: "first" }, { id: "second" }], undefined)?.id).toBe("first");
  });
});
