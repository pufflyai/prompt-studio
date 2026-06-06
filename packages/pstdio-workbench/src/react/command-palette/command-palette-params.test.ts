import { describe, expect, test } from "bun:test";
import {
  buildCommandParamInitialValues,
  hasCommandParameters,
  normalizeCommandParamValues,
} from "./command-palette-params";

describe("command palette params", () => {
  test("detects commands with declared params", () => {
    expect(hasCommandParameters(undefined)).toBe(false);
    expect(hasCommandParameters({})).toBe(false);
    expect(hasCommandParameters({ title: { type: "text" } })).toBe(true);
  });

  test("builds editable initial values from defaults and contributed args", () => {
    expect(
      buildCommandParamInitialValues(
        {
          title: { type: "text", defaultValue: "Untitled" },
          amount: { type: "number", defaultValue: 1 },
          tags: { type: "json", defaultValue: [] },
        },
        { amount: 2 },
      ),
    ).toEqual({ title: "Untitled", amount: "2", tags: "[]" });
  });

  test("normalizes form values into command params", () => {
    expect(
      normalizeCommandParamValues(
        {
          title: { type: "text" },
          count: { type: "number" },
          enabled: { type: "boolean" },
          tags: { type: "json" },
          empty: { type: "text" },
        },
        {
          title: "New ticket",
          count: "3",
          enabled: true,
          tags: '["bug"]',
          empty: "",
        },
      ),
    ).toEqual({ title: "New ticket", count: 3, enabled: true, tags: ["bug"] });
  });
});
