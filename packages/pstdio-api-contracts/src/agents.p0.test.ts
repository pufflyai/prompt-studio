import { describe, expect, test } from "bun:test";
import { agentInfoSchema, agentModelSchema, findAgentModel, resolveAgentModelParams } from "./agents";
import { l10n } from "./extension-kernel/l10n";

test("agent listings and model overrides preserve localized harness choices", () => {
  const mode = {
    type: "select" as const,
    options: [
      { value: "plan", label: "Plan", localizedLabel: l10n("mode.plan", "Plan") },
      { value: "agent", label: "Agent" },
    ],
  };
  const agent = agentInfoSchema.parse({
    id: "agent",
    name: "Agent",
    availability: { type: "INSTALLED" },
    capabilities: [],
    supportsModels: true,
    params: { mode },
  });
  expect(agent.params?.mode).toEqual(mode);
  expect(agentModelSchema.parse({ id: "model", paramOverrides: { mode } }).paramOverrides?.mode).toEqual(mode);
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
