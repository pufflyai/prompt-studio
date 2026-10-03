import type { ViewFilterRule } from "./types/collection-view";

/** Migrate saved enum rules using the owning extension's mapping, never row-value coercion. */
export const normalizeBooleanViewRule = (
  rule: ViewFilterRule,
  type: { kind: string; legacyValues?: Record<string, boolean> },
): ViewFilterRule => {
  const mapping = type.kind === "boolean" ? type.legacyValues : undefined;
  if (!mapping || !Array.isArray(rule.value) || rule.value.length === 0) return rule;
  if (rule.condition !== "is-any-of" && rule.condition !== "is-none-of") return rule;
  if (rule.value.some((value) => !Object.hasOwn(mapping, value))) return rule;
  const values = new Set(rule.value.map((value) => mapping[value]!));
  if (values.size === 2)
    return { attributeId: rule.attributeId, condition: rule.condition === "is-any-of" ? "is-not-empty" : "is-empty" };
  return {
    attributeId: rule.attributeId,
    condition: rule.condition === "is-any-of" ? "is" : "is-not",
    value: [...values][0]!,
  };
};
