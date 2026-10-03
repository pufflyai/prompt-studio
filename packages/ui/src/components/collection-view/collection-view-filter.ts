import { normalizeBooleanViewRule, type ViewFilterGroup, type ViewFilterRule } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor, KanbanRendererRow } from "../kanban-renderer/types";
import {
  acceptedCondition,
  findField,
  getAttributeStringValues,
  getAttributeValue,
  parseViewDate,
} from "./collection-view-fields";

type RowTest = (row: KanbanRendererRow) => boolean;

export const isFilterGroup = (rule: ViewFilterRule | ViewFilterGroup): rule is ViewFilterGroup => "conjunction" in rule;

const RELATIVE_DAY = /^today([+-]\d+)?$/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const dayKey = (date: Date) => date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();

/** Relative days resolve against the viewer's local date each time the view renders. */
export const resolveViewDay = (value: string, today: Date) => {
  const relative = RELATIVE_DAY.exec(value);
  if (relative) {
    const offset = Number(relative[1] ?? 0);
    return dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
  }
  const iso = ISO_DAY.exec(value);
  if (!iso) return undefined;
  return Number(iso[1]) * 10_000 + Number(iso[2]) * 100 + Number(iso[3]);
};

const rowDay = (value: unknown) => {
  const date = parseViewDate(value);
  return date && dayKey(date);
};

const rowNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
};

const rowText = (row: KanbanRendererRow, field: AttributeDescriptor) =>
  getAttributeStringValues(row, field).join(" ").toLocaleLowerCase();

const compareTests: Record<string, (left: number, right: number) => boolean> = {
  is: (left, right) => left === right,
  gt: (left, right) => left > right,
  gte: (left, right) => left >= right,
  lt: (left, right) => left < right,
  lte: (left, right) => left <= right,
  "is-before": (left, right) => left < right,
  "is-after": (left, right) => left > right,
  "is-on-or-before": (left, right) => left <= right,
  "is-on-or-after": (left, right) => left >= right,
};

const ordered = (read: (value: unknown) => number | undefined, condition: string, target: number) => {
  if (condition === "is-not") return (value: unknown) => read(value) !== target;
  const test = compareTests[condition]!;
  return (value: unknown) => {
    const left = read(value);
    return left !== undefined && test(left, target);
  };
};

const compileListRule = (field: AttributeDescriptor, condition: string, value: string[]): RowTest | undefined => {
  if (value.length === 0) return undefined;
  const matched = (row: KanbanRendererRow) =>
    getAttributeStringValues(row, field).filter((entry) => value.includes(entry));
  if (condition === "is-any-of" || condition === "has-any-of") return (row) => matched(row).length > 0;
  if (condition === "is-none-of" || condition === "has-none-of") return (row) => matched(row).length === 0;
  if (condition === "has-all-of") return (row) => new Set(matched(row)).size === new Set(value).size;
  return undefined;
};

const compileTextRule = (field: AttributeDescriptor, condition: string, value: string): RowTest | undefined => {
  if (value === "") return undefined;
  const needle = value.toLocaleLowerCase();
  if (condition === "contains") return (row) => rowText(row, field).includes(needle);
  if (condition === "does-not-contain") return (row) => !rowText(row, field).includes(needle);
  if (condition === "is") return (row) => rowText(row, field) === needle;
  if (condition === "is-not") return (row) => rowText(row, field) !== needle;
  return undefined;
};

const compileValueRule = (
  field: AttributeDescriptor,
  condition: string,
  value: ViewFilterRule["value"],
  today: Date,
): RowTest | undefined => {
  const kind = field.type.kind;
  if (Array.isArray(value)) return compileListRule(field, condition, value);
  if (kind === "boolean" && typeof value === "boolean") {
    return (row) => {
      const actual = getAttributeValue(row, field);
      if (condition === "is-not" && (actual === undefined || actual === null)) return true;
      return typeof actual === "boolean" && (condition === "is" ? actual === value : actual !== value);
    };
  }
  if (kind === "number" && typeof value === "number") {
    const test = ordered(rowNumber, condition, value);
    return (row: KanbanRendererRow) => test(getAttributeValue(row, field));
  }
  if (kind === "date" && typeof value === "string") {
    const target = resolveViewDay(value, today);
    if (target === undefined) return undefined;
    const test = ordered(rowDay, condition, target);
    return (row: KanbanRendererRow) => test(getAttributeValue(row, field));
  }
  if (kind === "string" && typeof value === "string") return compileTextRule(field, condition, value);
  return undefined;
};

/** Returns undefined for a rule that is still being built or no longer fits its field. */
const compileRule = (rule: ViewFilterRule, fields: AttributeDescriptor[], today: Date): RowTest | undefined => {
  const field = findField(fields, rule.attributeId);
  if (!field) return undefined;
  rule = normalizeBooleanViewRule(rule, field.type);
  const condition = acceptedCondition(field, rule.condition);
  // Old views picked exact values on every field. When a host cannot tell a field's kind up front,
  // they still arrive as "any of" lists, and keep their meaning.
  if (!condition && field.type.kind !== "boolean" && rule.condition === "is-any-of" && Array.isArray(rule.value))
    return compileListRule(field, rule.condition, rule.value);
  if (!condition) return undefined;
  if (condition === "is-empty") return (row) => getAttributeStringValues(row, field).length === 0;
  if (condition === "is-not-empty") return (row) => getAttributeStringValues(row, field).length > 0;
  return compileValueRule(field, condition, rule.value, today);
};

const compileGroup = (group: ViewFilterGroup, fields: AttributeDescriptor[], today: Date): RowTest | undefined => {
  const tests = group.rules.flatMap((rule) => {
    const test = isFilterGroup(rule) ? compileGroup(rule, fields, today) : compileRule(rule, fields, today);
    return test ? [test] : [];
  });
  if (tests.length === 0) return undefined;
  if (group.conjunction === "or") return (row) => tests.some((test) => test(row));
  return (row) => tests.every((test) => test(row));
};

/** Rules that are incomplete or no longer fit a field are skipped, so they never hide rows. */
export const filterRowsByView = <TRow extends KanbanRendererRow>(
  rows: TRow[],
  filter: ViewFilterGroup,
  fields: AttributeDescriptor[],
  today = new Date(),
) => {
  const test = compileGroup(filter, fields, today);
  return test ? rows.filter(test) : rows;
};

/** The number of rules a person sees in the criteria row and the Filter button. */
export const countFilterRules = (filter: ViewFilterGroup) =>
  filter.rules.reduce((count, rule) => count + (isFilterGroup(rule) ? rule.rules.length : 1), 0);
