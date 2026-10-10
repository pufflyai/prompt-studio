import { describe, expect, test } from "bun:test";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { filterRowsByView } from "../collection-view/collection-view-filter";
import { getCreateAttributeValues } from "./kanban-renderer-create-values";
import type { AttributeDescriptor } from "./types";

const attributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    editable: true,
    type: {
      kind: "enum",
      options: [
        { value: "backlog", label: "Backlog" },
        { value: "todo", label: "Todo" },
      ],
    },
  },
  {
    id: "type",
    label: "Type",
    editable: true,
    type: {
      kind: "enum",
      options: [
        { value: "bug", label: "Bug" },
        { value: "feature", label: "Feature" },
      ],
    },
  },
  {
    id: "track",
    label: "Track",
    editable: true,
    type: {
      kind: "enum-multi",
      options: [
        { value: "ui", label: "UI" },
        { value: "agents", label: "Agents" },
      ],
    },
  },
  { id: "created", label: "Created", type: { kind: "date" } },
];

const expectVisible = (filter: ViewFilterGroup) => {
  const values = getCreateAttributeValues(attributes, "status", "backlog", filter);
  const row = { id: "new", title: "New ticket", attributes: values };
  expect(filterRowsByView([row], filter, attributes)).toEqual([row]);
  return values;
};

describe("creation in a filtered board", () => {
  test("seeds the selected column and matching single and multiple properties", () => {
    const filter: ViewFilterGroup = {
      conjunction: "and",
      rules: [
        { attributeId: "type", condition: "is-any-of", value: ["bug"] },
        { attributeId: "track", condition: "has-all-of", value: ["ui", "agents"] },
      ],
    };
    expect(expectVisible(filter)).toEqual({ status: "backlog", type: "bug", track: ["ui", "agents"] });
  });

  test("chooses matching alternatives without inheriting excluded options", () => {
    expect(
      expectVisible({
        conjunction: "and",
        rules: [
          { attributeId: "track", condition: "has-any-of", value: ["agents", "ui"] },
          { attributeId: "track", condition: "has-none-of", value: ["agents"] },
          { attributeId: "type", condition: "is-none-of", value: ["feature"] },
        ],
      }),
    ).toMatchObject({ type: "bug", track: ["ui"] });
  });

  test("uses a matching OR branch within an AND view", () => {
    expectVisible({
      conjunction: "and",
      rules: [{ attributeId: "track", condition: "has-any-of", value: ["ui"] }],
      groups: [
        {
          conjunction: "or",
          rules: [
            { attributeId: "status", condition: "is-any-of", value: ["todo"] },
            { attributeId: "type", condition: "is-any-of", value: ["bug"] },
          ],
        },
      ],
    });
  });

  test("keeps unfiltered properties empty and skips read-only fields", () => {
    expect(getCreateAttributeValues(attributes, "status", "backlog")).toEqual({
      status: "backlog",
      type: "",
      track: [],
    });
  });

  test("chooses an editable alternative instead of assuming a read-only rule matches", () => {
    const filter: ViewFilterGroup = {
      conjunction: "or",
      rules: [
        { attributeId: "created", condition: "is-before", value: "2000-01-01" },
        { attributeId: "track", condition: "has-any-of", value: ["ui"] },
      ],
    };
    const values = getCreateAttributeValues(attributes, "status", "backlog", filter);
    const row = { id: "new", title: "New", attributes: { ...values, created: new Date().toISOString() } };
    expect(filterRowsByView([row], filter, attributes)).toEqual([row]);
    expect(values.track).toEqual(["ui"]);
  });
});
