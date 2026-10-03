import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { attributes } from "../kanban-renderer/kanban-renderer-story-fixtures";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { withTitleField } from "./collection-view-fields";
import type { RuleValueOption } from "./filter-rule-value";

export const storyFields: AttributeDescriptor[] = withTitleField([
  ...attributes,
  { id: "archived", label: "Archived", type: { kind: "boolean" }, filterable: true },
  { id: "score", label: "Score", type: { kind: "number" }, filterable: true, sortable: true },
]).map((field) => ({ ...field, filterable: true, sortable: field.type.kind !== "enum-multi" }));

const people = ["Alex", "Sam", "Jordan"];

export const storyOptions = (field: AttributeDescriptor): RuleValueOption[] => {
  if (field.type.kind === "user") return people.map((name, index) => ({ value: name, label: name, count: 3 - index }));
  if (field.type.kind !== "enum" && field.type.kind !== "enum-multi") return [];
  const options = Array.isArray(field.type.options) ? field.type.options : field.type.options.getSnapshot();
  return options.map((option, index) => ({ value: option.value, label: option.label, count: index + 1 }));
};

export const storyFilter: ViewFilterGroup = {
  conjunction: "and",
  rules: [
    { attributeId: "status", condition: "is-none-of", value: ["done"] },
    { attributeId: "priority", condition: "is-any-of", value: ["high", "medium"] },
    {
      conjunction: "or",
      rules: [
        { attributeId: "assignee", condition: "is-any-of", value: ["Alex"] },
        { attributeId: "updated", condition: "is-after", value: "today-7" },
      ],
    },
  ],
};
