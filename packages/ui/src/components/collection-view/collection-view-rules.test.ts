import { describe, expect, test } from "bun:test";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import {
  addRule,
  clearQuickOptions,
  quickOptionValues,
  selectRuleValues,
  setQuickOptions,
  setRuleAt,
} from "./collection-view-rules";

const status: AttributeDescriptor = { id: "status", label: "Status", type: { kind: "enum", options: [] } };
const tags: AttributeDescriptor = { id: "tags", label: "Tags", type: { kind: "enum-multi", options: [] } };
const empty: ViewFilterGroup = { conjunction: "and", rules: [] };

describe("quick option rules", () => {
  test("choosing values writes one any-of rule per field and removes it when empty", () => {
    let filter = setQuickOptions(empty, status, ["todo"]);
    filter = setQuickOptions(filter, status, ["todo", "doing"]);
    filter = setQuickOptions(filter, tags, ["ui"]);

    expect(filter.rules).toEqual([
      { attributeId: "status", condition: "is-any-of", value: ["todo", "doing"] },
      { attributeId: "tags", condition: "has-any-of", value: ["ui"] },
    ]);
    expect(quickOptionValues(filter, "status")).toEqual(["todo", "doing"]);

    filter = setQuickOptions(filter, status, []);
    expect(filter.rules).toEqual([{ attributeId: "tags", condition: "has-any-of", value: ["ui"] }]);
    expect(clearQuickOptions(filter, "tags")).toEqual(empty);
  });

  test("a quick rule respects the chosen conjunction", () => {
    const filter: ViewFilterGroup = {
      conjunction: "or",
      rules: [{ attributeId: "owner", condition: "is-empty" }],
    };

    expect(setQuickOptions(filter, status, ["todo"])).toEqual({
      conjunction: "or",
      rules: [
        { attributeId: "owner", condition: "is-empty" },
        { attributeId: "status", condition: "is-any-of", value: ["todo"] },
      ],
    });
    expect(quickOptionValues(setQuickOptions(filter, status, ["todo"]), "status")).toEqual(["todo"]);
  });
});

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
