import { type Param, ParamEditor, type ParamValueMap } from "@pstdio/ui";
import type { HarnessParamsInfo } from "pstdio-api-contracts";
import { type HarnessParamValues, resolveHarnessParamText, updateHarnessParamOverride } from "./harness-param-values";

interface HarnessParamEditorProps {
  schema: HarnessParamsInfo | undefined;
  defaults?: HarnessParamValues;
  overrides: HarnessParamValues;
  onOverridesChange: (next: HarnessParamValues) => void;
  disabled?: boolean;
}

const resolveParamValue = (
  key: string,
  descriptor: HarnessParamsInfo[string],
  defaults: HarnessParamValues | undefined,
  overrides: HarnessParamValues,
) => {
  const value = overrides[key] ?? defaults?.[key] ?? descriptor.defaultValue;
  if (value !== undefined) return value;
  return descriptor.type === "boolean" ? false : (descriptor.options[0]?.value ?? "");
};

const buildParam = (key: string, descriptor: HarnessParamsInfo[string]): Param => {
  const name = resolveHarnessParamText(key, descriptor.label);
  const description = resolveHarnessParamText("", descriptor.description) || undefined;

  if (descriptor.type === "boolean") {
    return { id: key, type: "boolean", name, description, defaultValue: descriptor.defaultValue ?? false };
  }

  return {
    id: key,
    type: "selection",
    name,
    description,
    defaultValue: descriptor.defaultValue ?? descriptor.options[0]?.value ?? "",
    options: descriptor.options.map((option) => ({
      id: option.value,
      name: option.label,
      icon: option.icon,
    })),
  };
};

export const HarnessParamEditor = (props: HarnessParamEditorProps) => {
  const { schema, defaults, overrides, onOverridesChange, disabled = false } = props;
  const entries = Object.entries(schema ?? {});
  if (entries.length === 0) return null;

  const params = entries.map(([key, descriptor]) => buildParam(key, descriptor));
  const values = Object.fromEntries(
    entries.map(([key, descriptor]) => [key, resolveParamValue(key, descriptor, defaults, overrides)]),
  ) as ParamValueMap;

  return (
    <ParamEditor
      params={params}
      defaultValues={values}
      readOnly={disabled}
      onChange={(key, value) => {
        if (typeof value !== "string" && typeof value !== "boolean") return;
        onOverridesChange(updateHarnessParamOverride(overrides, defaults, key, value));
      }}
    />
  );
};
