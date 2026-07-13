import { describe, expect, test } from "bun:test";
import { filterHarnessParamValues } from "./harness-param-values";

describe("filterHarnessParamValues", () => {
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
