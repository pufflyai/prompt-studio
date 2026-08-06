import type { ExtensionSettingValueRecord } from "@pstdio/sdk/api";
import type { Param, ParamValueMap } from "@pstdio/ui";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";

const settingValue = (record: ExtensionSettingValueRecord) =>
  record.value !== undefined ? record.value : record.default;

// Maps declared extension settings onto ParamEditor fields. Array/object settings
// have no generic editor and stay managed by the extension itself.
export const settingsToParams = (settings: ExtensionSettingValueRecord[]) =>
  settings.flatMap<Param>((record) => {
    const base = {
      id: record.key,
      name: resolveLocalizableString(record.title, record.extensionId) || record.key,
      description: resolveLocalizableString(record.description, record.extensionId) || undefined,
    };
    const value = settingValue(record);

    if (record.type === "boolean") return [{ ...base, type: "boolean", defaultValue: Boolean(value) }];
    if (record.type === "number") return [{ ...base, type: "number", defaultValue: Number(value ?? 0) }];
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
