import type { HarnessParamsInfo } from "pstdio-api-contracts";

export type HarnessParamValues = Record<string, string | boolean>;

export const resolveHarnessParamText = (
  fallback: string,
  value: string | { $l10n: string; default?: string } | undefined,
) => {
  if (typeof value === "string") return value;
  if (value) return value.default ?? value.$l10n;
  return fallback.replace(/[-_]/g, " ");
};

export const removeHarnessParamOverride = (overrides: HarnessParamValues, key: string) => {
  const { [key]: _removed, ...rest } = overrides;
  return rest;
};

export const updateHarnessParamOverride = (
  overrides: HarnessParamValues,
  defaults: HarnessParamValues | undefined,
  key: string,
  value: string | boolean,
) => (Object.is(defaults?.[key], value) ? removeHarnessParamOverride(overrides, key) : { ...overrides, [key]: value });

export const filterHarnessParamValues = (
  schema: HarnessParamsInfo | null | undefined,
  values: HarnessParamValues | undefined,
) => {
  if (!schema || !values) return {};

  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => {
      const descriptor = schema[key];
      if (!descriptor) return false;
      if (descriptor.type === "boolean") return typeof value === "boolean";
      return typeof value === "string" && descriptor.options.some((option) => option.value === value);
    }),
  );
};

export const harnessParamValuesEqual = (left: HarnessParamValues, right: HarnessParamValues) => {
  const leftEntries = Object.entries(left);
  return leftEntries.length === Object.keys(right).length && leftEntries.every(([key, value]) => right[key] === value);
};
