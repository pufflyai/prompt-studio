import { describe, expect, test } from "bun:test";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { addRule, selectRuleValues, setRuleAt } from "./collection-view-rules";

const status: AttributeDescriptor = { id: "status", label: "Status", type: { kind: "enum", options: [] } };
const tags: AttributeDescriptor = { id: "tags", label: "Tags", type: { kind: "enum-multi", options: [] } };
const empty: ViewFilterGroup = { conjunction: "and", rules: [] };

describe("rule edits", () => {
  test("removing a rule keeps the other field selections", () => {
    const filter = addRule(addRule(empty, { attributeId: "status", condition: "is-empty" }), {
      attributeId: "owner",
      condition: "is-empty",
    });

    expect(setRuleAt(filter, 1, undefined).rules).toEqual([{ attributeId: "status", condition: "is-empty" }]);
  });
});

describe("categorical empty predicates", () => {
  test("choosing an option derives membership and keeps predicate polarity", () => {
    expect(selectRuleValues(status, { attributeId: "status", condition: "is-empty" }, ["todo"])).toEqual({
      attributeId: "status",
      condition: "is-any-of",
      value: ["todo"],
    });
    expect(selectRuleValues(tags, { attributeId: "tags", condition: "is-not-empty" }, ["ui"])).toEqual({
      attributeId: "tags",
      condition: "has-none-of",
      value: ["ui"],
    });
  });
  test("editing values keeps a supported all-values predicate", () => {
    expect(
      selectRuleValues(tags, { attributeId: "tags", condition: "has-all-of", value: ["ui"] }, ["ui", "api"]),
    ).toEqual({ attributeId: "tags", condition: "has-all-of", value: ["ui", "api"] });
  });
});

describe("boolean picker predicates", () => {
  test("choosing a truth value preserves an existing inequality family", () => {
    const field: AttributeDescriptor = { id: "archived", label: "Archived", type: { kind: "boolean" } };
    const rule = { attributeId: "archived", condition: "is-not" as const, value: true };
    expect(selectRuleValues(field, rule, false)).toEqual(rule);
    expect(selectRuleValues(field, rule, true)).toEqual({ ...rule, value: false });
  });
});
