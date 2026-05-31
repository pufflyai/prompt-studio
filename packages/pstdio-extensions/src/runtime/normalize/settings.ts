import type { NormalizedExtension, RuntimeExtensionSettingRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";

const settingTypes = new Set(["boolean", "number", "string", "array", "object"]);

const isValidType = (type: string, value: unknown) => {
  if (type === "boolean") return typeof value === "boolean";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "string") return typeof value === "string";
  if (type === "array") return Array.isArray(value);
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const hasOwn = (value: object, key: string) => Object.hasOwn(value, key);

const enumIncludes = (values: unknown[] | undefined, value: unknown) => {
  if (!values) return true;
  return values.some((candidate) => Object.is(candidate, value));
};

const invalidSetting = (input: {
  ext: NormalizedExtension;
  key: string;
  message: string;
  source: LoadedExtensionSource;
}) =>
  createDiagnostic({
    code: "extension_setting_invalid",
    message: input.message,
    extensionId: input.ext.id,
    sourcePath: input.source.sourcePath,
    metadata: { key: input.key },
  });

const invalidScope = (ext: NormalizedExtension, source: LoadedExtensionSource, key: string) =>
  createDiagnostic({
    code: "extension_settings_scope_invalid",
    message: `Extension setting "${key}" must declare scope "project" or "global"`,
    extensionId: ext.id,
    sourcePath: source.sourcePath,
    metadata: { key },
  });

const validateSetting = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  key: string,
  setting: Record<string, unknown>,
  runtime: Accumulator,
) => {
  if (setting.scope !== "project" && setting.scope !== "global") {
    runtime.diagnostics.push(invalidScope(ext, source, key));
    return false;
  }

  if (typeof setting.type !== "string" || !settingTypes.has(setting.type)) {
    runtime.diagnostics.push(
      invalidSetting({
        ext,
        key,
        message: `Extension setting "${key}" must declare a supported type`,
        source,
      }),
    );
    return false;
  }

  if (hasOwn(setting, "default") && !isValidType(setting.type, setting.default)) {
    runtime.diagnostics.push(
      invalidSetting({
        ext,
        key,
        message: `Extension setting "${key}" default must match type "${setting.type}"`,
        source,
      }),
    );
    return false;
  }

  if (setting.enum !== undefined) {
    if (!Array.isArray(setting.enum) || setting.enum.some((value) => !isValidType(setting.type as string, value))) {
      runtime.diagnostics.push(
        invalidSetting({
          ext,
          key,
          message: `Extension setting "${key}" enum values must match type "${setting.type}"`,
          source,
        }),
      );
      return false;
    }
  }

  if (hasOwn(setting, "default") && !enumIncludes(setting.enum, setting.default)) {
    runtime.diagnostics.push(
      invalidSetting({
        ext,
        key,
        message: `Extension setting "${key}" default must be one of its enum values`,
        source,
      }),
    );
    return false;
  }

  return true;
};

export const registerSettings = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const settings = source.definition.settings;
  if (!isRecord(settings)) return;
  const properties = settings.properties;
  if (!isRecord(properties)) return;

  for (const [key, setting] of Object.entries(properties)) {
    if (!isRecord(setting)) {
      runtime.diagnostics.push(
        invalidSetting({
          ext,
          key,
          message: `Extension setting "${key}" must be an object`,
          source,
        }),
      );
      continue;
    }
    if (!validateSetting(ext, source, key, setting, runtime)) continue;
    runtime.settings.push({
      id: `${ext.name}.${key}`,
      key,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: setting as RuntimeExtensionSettingRecord["contribution"],
    });
  }
};
