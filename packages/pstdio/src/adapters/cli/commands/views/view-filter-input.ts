import { type BoardField, findViewFilterProblem, viewFilterValueKind } from "@pstdio/sdk/api";
import type { ViewFilterCondition, ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";

const resolveOption = (field: BoardField, value: string) => {
  if (!field.options || field.options.some((option) => option.value === value)) return value;
  const matches = field.options.filter((option) => option.label === value);
  if (matches.length > 1)
    throw new Error(`Ambiguous label "${value}". Matching values: ${matches.map((option) => option.value).join(", ")}`);
  if (!matches.length)
    throw new Error(
      `Invalid value "${value}". Valid values: ${field.options.map((option) => option.value).join(", ")}`,
    );
  return matches[0].value;
};
const parseValue = (field: BoardField, condition: ViewFilterCondition, raw: string) => {
  const kind = viewFilterValueKind(field.kind, condition);
  if (kind === "number") return Number(raw);
  if (kind === "options") return raw.split(",").map((value) => resolveOption(field, value.trim()));
  return raw;
};
const only = (rule: ViewFilterRule): ViewFilterGroup => ({ conjunction: "and", rules: [rule] });
const checked = (rule: ViewFilterRule, fields: BoardField[]) => {
  const problem = findViewFilterProblem(only(rule), fields);
  if (problem) throw new Error(problem);
  return rule;
};
/** Reads `<field> <condition> [value]`. The value is the rest of the text. */
const parseRule = (text: string, fields: BoardField[]) => {
  const match = /^\s*(\S+)\s+(\S+)(?:\s+([\s\S]*\S))?\s*$/.exec(text);
  if (!match) throw new Error(`Filter "${text}" must be "<field> <condition> [value]"`);
  const [, attributeId, condition, raw] = match as unknown as [string, string, ViewFilterCondition, string?];
  // The field and condition are checked first, so a wrong condition lists the ones the field accepts.
  const rule = checked({ attributeId, condition }, fields);
  const field = fields.find((field) => field.id === attributeId)!;
  if (raw === undefined) {
    if (viewFilterValueKind(field.kind, condition) !== "none")
      throw new Error(`Condition "${condition}" on "${attributeId}" needs a value`);
    return rule;
  }
  return checked({ ...rule, value: parseValue(field, condition, raw) }, fields);
};
export const buildFilter = (flags: { filter?: string[]; "filter-json"?: string }, fields: BoardField[]) => {
  if (flags.filter && flags["filter-json"] !== undefined) throw new Error("Use --filter or --filter-json, not both");
  if (flags["filter-json"] !== undefined) return JSON.parse(flags["filter-json"]) as ViewFilterGroup;
  if (!flags.filter) return undefined;
  const rules =
    flags.filter.length === 1 && flags.filter[0] === "none" ? [] : flags.filter.map((text) => parseRule(text, fields));
  return { conjunction: "and", rules } satisfies ViewFilterGroup;
};
