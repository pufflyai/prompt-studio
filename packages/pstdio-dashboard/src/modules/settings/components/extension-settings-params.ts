import type { ExtensionSettingValueRecord } from "@pstdio/sdk/api";
import type { Param, ParamValueMap } from "@pstdio/ui/param-editor";
import type { CommandParamOption, CommandParamSchema } from "@pstdio/workbench";
import type { CommandOptionState } from "@pstdio/workbench/react";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";

const settingValue = (record: ExtensionSettingValueRecord) =>
  record.value !== undefined ? record.value : record.default;

// A saved value stays listed after the command stops offering it, so the form keeps
// showing the value the extension still uses.
const choicesWithSavedValue = (options: CommandParamOption[], saved: string) => {
  const choices = options.map((option) => ({ id: option.value, name: option.label }));
  if (!saved || choices.some((choice) => choice.id === saved)) return choices;
  return [...choices, { id: saved, name: saved }];
};

// Maps declared extension settings onto ParamEditor fields. Array/object settings
// have no generic editor and stay managed by the extension itself.
export const settingsToParams = (
  settings: ExtensionSettingValueRecord[],
  optionStates: Record<string, CommandOptionState> = {},
) =>
  settings.flatMap<Param>((record) => {
    const base = {
      id: record.key,
      name: resolveLocalizableString(record.title, record.extensionId) || record.key,
      description: resolveLocalizableString(record.description, record.extensionId) || undefined,
    };
    const value = settingValue(record);

    if (record.type === "boolean") return [{ ...base, type: "boolean", defaultValue: Boolean(value) }];
    if (record.type === "number") return [{ ...base, type: "number", defaultValue: Number(value ?? 0) }];
    if (record.type === "string" && record.options) {
      const state = optionStates[record.key];
      const saved = String(value ?? "");
      return [
        {
          ...base,
          type: "selection",
          defaultValue: saved,
          options: choicesWithSavedValue(state?.options ?? [], saved),
          searchable: true,
          clearable: true,
          // Only while loading: after a failure the saved value must stay editable and clearable.
          disabled: state?.status === "loading",
        },
      ];
    }
    if (record.type === "string" && record.enum?.length) {
      return [
        {
          ...base,
          type: "selection",
          defaultValue: String(value ?? ""),
          options: record.enum.map((option) => ({ id: String(option), name: String(option) })),
        },
      ];
    }
    if (record.type === "string") {
      return [{ ...base, type: "text", singleLine: true, defaultValue: String(value ?? "") }];
    }
    return [];
  });

const paramDescriptor = (record: ExtensionSettingValueRecord) => {
  if (record.type === "string" && record.options) return { type: "select", options: record.options };
  if (record.type === "string") return { type: "text" };
  if (record.type === "number" || record.type === "boolean") return { type: record.type };
  return null;
};

// The same option sources a command dialog loads, keyed by setting. Every other setting
// is described too, so an option command param naming it receives a typed value.
export const settingsToParamSchema = (settings: ExtensionSettingValueRecord[]): CommandParamSchema =>
  Object.fromEntries(
    settings.flatMap((record) => {
      const descriptor = paramDescriptor(record);
      return descriptor ? [[record.key, descriptor]] : [];
    }),
  );

// Clearing a choice loaded from a command removes the saved value, so the extension
// falls back to its default.
export const settingChangeValue = (settings: ExtensionSettingValueRecord[], key: string, value: unknown) =>
  value === "" && settings.some((record) => record.key === key && record.options) ? undefined : value;

export const settingsToValues = (settings: ExtensionSettingValueRecord[]) => {
  const values: ParamValueMap = {};
  for (const record of settings) {
    const value = settingValue(record);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values[record.key] = value;
    }
  }
  return values;
};

// Setting values that option command params can name with `{ kind: "param-value", key }`.
export const settingsToOptionValues = (settings: ExtensionSettingValueRecord[]) => {
  const values: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(settingsToValues(settings))) {
    values[key] = typeof value === "boolean" ? value : String(value);
  }
  return values;
};
