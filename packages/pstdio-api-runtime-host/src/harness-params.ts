import type { HarnessParams, HarnessParamsSchema } from "pstdio-api-contracts/extension-kernel";
export const defaultHarnessParams = (schema: HarnessParamsSchema | null | undefined) => {
  const values: HarnessParams = {};
  if (!schema) return values;

  for (const [key, descriptor] of Object.entries(schema)) {
    if (descriptor.defaultValue !== undefined) values[key] = descriptor.defaultValue;
  }

  return values;
};

const formatValueList = (values: string[]) => values.map((value) => `"${value}"`).join(", ");

export const validateHarnessParams = (
  schema: HarnessParamsSchema | null | undefined,
  params: HarnessParams | undefined,
) => {
  if (!schema) {
    if (!params || Object.keys(params).length === 0) return;
    throw new Error("Harness does not declare params.");
  }

  validateRequiredHarnessParams(schema, params);

  if (!params || Object.keys(params).length === 0) return;

  validateDeclaredHarnessParams(schema, params);
};

const validateRequiredHarnessParams = (schema: HarnessParamsSchema, params: HarnessParams | undefined) => {
  for (const [key, descriptor] of Object.entries(schema)) {
    if (descriptor.required && !Object.hasOwn(params ?? {}, key)) {
      throw new Error(`Harness param "${key}" is required.`);
    }
  }
};

const validateDeclaredHarnessParams = (schema: HarnessParamsSchema, params: HarnessParams) => {
  for (const [key, value] of Object.entries(params)) {
    const descriptor = schema[key];
    if (!descriptor) throw new Error(`Harness param "${key}" is not declared.`);

    if (descriptor.type === "boolean") {
      if (typeof value !== "boolean") throw new Error(`Harness param "${key}" must be a boolean.`);
      continue;
    }

    const allowed = descriptor.options.map((option) => option.value);
    if (typeof value !== "string" || !allowed.includes(value)) {
      throw new Error(`Harness param "${key}" must be one of ${formatValueList(allowed)}.`);
    }
  }
};
