import { expect, test } from "bun:test";
import { normalizeBooleanViewRule } from "./boolean-view-filter";

const type = { kind: "boolean" as const, legacyValues: { active: false, archived: true } };
test("old option rules keep their meaning when a field becomes boolean", () => {
  for (const [condition, expected] of [
    ["is-any-of", "is"],
    ["is-none-of", "is-not"],
  ] as const) {
    for (const [id, value] of Object.entries(type.legacyValues)) {
      const converted = normalizeBooleanViewRule({ attributeId: "archive", condition, value: [id] }, type);
      expect(converted).toEqual({ attributeId: "archive", condition: expected, value });
      expect(normalizeBooleanViewRule(converted, type)).toEqual(converted);
    }
    expect(
      normalizeBooleanViewRule({ attributeId: "archive", condition, value: ["active", "archived"] }, type),
    ).toEqual({ attributeId: "archive", condition: condition === "is-any-of" ? "is-not-empty" : "is-empty" });
  }
});
test("unknown or incomplete old rules are preserved without guessing", () => {
  for (const value of [[], ["active", "unknown"]]) {
    const rule = { attributeId: "archive", condition: "is-any-of" as const, value };
    expect(normalizeBooleanViewRule(rule, type)).toEqual(rule);
  }
});
