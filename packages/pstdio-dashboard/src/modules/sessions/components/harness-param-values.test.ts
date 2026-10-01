import { describe, expect, test } from "bun:test";
import { filterHarnessParamValues, resolveHarnessParamDefaults } from "./harness-param-values";

describe("filterHarnessParamValues", () => {
  test("uses the selected model's default when the base default is unsupported", () => {
    expect(
      resolveHarnessParamDefaults(
        {
          effort: {
            type: "select",
            defaultValue: "high",
            options: [
              { label: "High", value: "high" },
              { label: "Max", value: "max" },
            ],
          },
        },
        { effort: "medium" },
      ),
    ).toEqual({ effort: "high" });
  });

  test("removes unsupported params and select values", () => {
    expect(
      filterHarnessParamValues(
        {
          thinking: {
            type: "select",
            options: [
              { label: "Low", value: "low" },
              { label: "High", value: "high" },
            ],
          },
          enabled: { type: "boolean" },
        },
        { thinking: "xhigh", enabled: true, removed: "legacy" },
      ),
    ).toEqual({ enabled: true });
  });
});
