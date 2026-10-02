import { describe, expect, test } from "bun:test";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import {
  addGroup,
  addRule,
  clearQuickOptions,
  quickOptionValues,
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

  test("a quick rule on an or filter keeps the or rules together in a group", () => {
    const filter: ViewFilterGroup = {
      conjunction: "or",
      rules: [{ attributeId: "owner", condition: "is-empty" }],
    };

    expect(setQuickOptions(filter, status, ["todo"])).toEqual({
      conjunction: "and",
      rules: [
        { conjunction: "or", rules: [{ attributeId: "owner", condition: "is-empty" }] },
        { attributeId: "status", condition: "is-any-of", value: ["todo"] },
      ],
    });
  });
});

describe("rule edits", () => {
  test("removing the last rule of a nested group removes the group", () => {
    const filter = addGroup(addRule(empty, { attributeId: "status", condition: "is-empty" }), {
      attributeId: "owner",
      condition: "is-empty",
    });

    expect(filter.rules[1]).toEqual({ conjunction: "or", rules: [{ attributeId: "owner", condition: "is-empty" }] });
    expect(setRuleAt(filter, [1, 0], undefined).rules).toEqual([{ attributeId: "status", condition: "is-empty" }]);
  });
});
