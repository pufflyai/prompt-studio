import type { ExtensionSettingDefinitionRecord } from "pstdio-api-contracts";
import type { CommandRunnerEnvironment, RuntimeExtensionSettingRecord } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

const toSettingDefinition = (setting: RuntimeExtensionSettingRecord): ExtensionSettingDefinitionRecord => ({
  key: setting.key,
  extensionId: setting.extensionId,
  type: setting.contribution.type,
  scope: setting.contribution.scope,
  default: setting.contribution.default,
  enum: setting.contribution.enum,
  title: setting.contribution.title,
  description: setting.contribution.description,
});

export const createSettingsApi = (
  deps: ExtensionsRouteDeps,
  input: {
    extensionId: string;
    extensionInstanceId: string;
    installedExtensionId: string;
    settings?: RuntimeExtensionSettingRecord[];
  },
): CommandRunnerEnvironment["settings"] => {
  const context = {
    extensionId: input.extensionId,
    extensionInstanceId: input.extensionInstanceId,
    installedExtensionId: input.installedExtensionId,
    definitions: (input.settings ?? []).map(toSettingDefinition),
  };

  return {
    async all() {
      const records = await deps.extensionSettingsService.list(context);
      return Object.fromEntries(records.map((record) => [record.key, record.value]));
    },
    async get(key) {
      const record = await deps.extensionSettingsService.get(context, String(key));
      return record.value as never;
    },
    async set(key, value) {
      await deps.extensionSettingsService.set(context, String(key), value);
    },
    async delete(key) {
      await deps.extensionSettingsService.delete(context, String(key));
    },
  };
};
