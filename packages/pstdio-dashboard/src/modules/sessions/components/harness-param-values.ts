import type { HarnessParamsInfo } from "pstdio-api-contracts";
import type { HarnessParamValues } from "./harness-param-controls";

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
