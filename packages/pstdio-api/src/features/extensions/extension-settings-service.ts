import type { ExtensionSettingDefinitionRecord, ExtensionSettingValueRecord } from "pstdio-api-contracts";
import type { createExtensionSettingsDBService, ExtensionSettingOwnerType } from "pstdio-db";

export type ExtensionSettingsContext = {
  extensionId: string;
  extensionInstanceId: string;
  installedExtensionId: string;
  definitions: ExtensionSettingDefinitionRecord[];
};

export class ExtensionSettingError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ExtensionSettingError";
    this.code = code;
  }
}

type ExtensionSettingsServiceDeps = {
  extensionSettingsDBService: ReturnType<typeof createExtensionSettingsDBService>;
};

const hasOwn = (value: object, key: string) => Object.hasOwn(value, key);

const isValidType = (type: ExtensionSettingDefinitionRecord["type"], value: unknown) => {
  if (type === "boolean") return typeof value === "boolean";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "string") return typeof value === "string";
  if (type === "array") return Array.isArray(value);
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const enumIncludes = (values: unknown[] | undefined, value: unknown) => {
  if (!values) return true;
  return values.some((candidate) => Object.is(candidate, value));
};

const ownerFor = (context: ExtensionSettingsContext, definition: ExtensionSettingDefinitionRecord) => {
  if (definition.scope === "global") {
    return {
      owner_type: "installed_extension" as ExtensionSettingOwnerType,
      owner_id: context.installedExtensionId,
      extension_id: context.extensionId,
    };
  }

  return {
    owner_type: "extension_instance" as ExtensionSettingOwnerType,
    owner_id: context.extensionInstanceId,
    extension_id: context.extensionId,
  };
};

const toValueRecord = (
  definition: ExtensionSettingDefinitionRecord,
  stored: { value_json: unknown } | null,
): ExtensionSettingValueRecord => ({
  ...definition,
  source: stored ? "stored" : "default",
  value: stored ? stored.value_json : hasOwn(definition, "default") ? definition.default : undefined,
});

export const createExtensionSettingsService = (deps: ExtensionSettingsServiceDeps) => {
  const definitionFor = (context: ExtensionSettingsContext, key: string) => {
    const definition = context.definitions.find(
      (candidate) => candidate.extensionId === context.extensionId && candidate.key === key,
    );
    if (!definition) {
      throw new ExtensionSettingError(
        "extension_setting_unknown_key",
        `Extension setting is not declared: ${context.extensionId}.${key}`,
      );
    }
    return definition;
  };

  const validateValue = (definition: ExtensionSettingDefinitionRecord, value: unknown) => {
    if (!isValidType(definition.type, value) || !enumIncludes(definition.enum, value)) {
      throw new ExtensionSettingError(
        "extension_setting_invalid",
        `Extension setting "${definition.key}" must be ${definition.type}`,
      );
    }
  };

  const validateScope = (
    definition: ExtensionSettingDefinitionRecord,
    key: string,
    scope: ExtensionSettingDefinitionRecord["scope"] | undefined,
  ) => {
    if (scope && definition.scope !== scope) {
      throw new ExtensionSettingError(
        "extension_settings_scope_mismatch",
        `Extension setting "${key}" is ${definition.scope}-scoped`,
      );
    }
  };

  const readStored = (context: ExtensionSettingsContext, definition: ExtensionSettingDefinitionRecord) =>
    deps.extensionSettingsDBService.getValue({
      ...ownerFor(context, definition),
      key: definition.key,
    });

  const list = async (
    context: ExtensionSettingsContext,
    scope?: ExtensionSettingDefinitionRecord["scope"],
  ): Promise<ExtensionSettingValueRecord[]> => {
    const records: ExtensionSettingValueRecord[] = [];
    for (const definition of context.definitions) {
      if (definition.extensionId !== context.extensionId) continue;
      if (scope && definition.scope !== scope) continue;
      const stored = await readStored(context, definition);
      records.push(toValueRecord(definition, stored));
    }
    return records;
  };

  const get = async (
    context: ExtensionSettingsContext,
    key: string,
    scope?: ExtensionSettingDefinitionRecord["scope"],
  ) => {
    const definition = definitionFor(context, key);
    validateScope(definition, key, scope);
    const stored = await readStored(context, definition);
    return toValueRecord(definition, stored);
  };

  const set = async (
    context: ExtensionSettingsContext,
    key: string,
    value: unknown,
    scope?: ExtensionSettingDefinitionRecord["scope"],
  ) => {
    const definition = definitionFor(context, key);
    validateScope(definition, key, scope);
    validateValue(definition, value);
    const stored = await deps.extensionSettingsDBService.setValue({
      ...ownerFor(context, definition),
      key,
      value_json: value,
    });
    return toValueRecord(definition, stored);
  };

  const deleteSetting = async (
    context: ExtensionSettingsContext,
    key: string,
    scope?: ExtensionSettingDefinitionRecord["scope"],
  ) => {
    const definition = definitionFor(context, key);
    validateScope(definition, key, scope);
    await deps.extensionSettingsDBService.deleteValue({ ...ownerFor(context, definition), key });
  };

  return { list, get, set, delete: deleteSetting };
};
