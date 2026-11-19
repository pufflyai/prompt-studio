import { describe, expect, test } from "bun:test";
import { findAgentModel, resolveAgentModelParams } from "./agents";

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
