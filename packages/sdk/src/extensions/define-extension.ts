import type {
  CommandDefinition,
  ExtensionDefinition,
  ExtensionSettingProperty,
  ExtensionSettingsContribution,
  HookDefinition,
  MiddlewareDefinition,
  ParamObjectSchema,
  ScheduleContribution,
  Struct,
} from "pstdio-api-contracts/extension-kernel";

type CommandSchemas = Record<string, ParamObjectSchema | undefined>;
type MiddlewareParams = Record<string, Struct>;
type MiddlewareResults = Record<string, unknown>;
type HookPayloads = Record<string, Struct>;
type EmptyMap = Record<string, never>;
type SettingProperties = Record<string, ExtensionSettingProperty>;
type EmptySettings = Record<string, never>;

type SettingValue<TProperty> = TProperty extends { type: "boolean" }
  ? boolean
  : TProperty extends { type: "number" }
    ? number
    : TProperty extends { type: "string" }
      ? string
      : TProperty extends { type: "array" }
        ? unknown[]
        : TProperty extends { type: "object" }
          ? Record<string, unknown>
          : unknown;

type SettingsMap<TSettings> = TSettings extends { properties: infer TProperties }
  ? {
      [K in keyof TProperties & string]: SettingValue<TProperties[K]>;
    }
  : EmptySettings;

type CommandDefinitions<TSchemas extends CommandSchemas, TSettings extends Record<string, unknown>> = {
  [K in keyof TSchemas]: CommandDefinition<TSchemas[K], unknown, TSettings>;
};

type MiddlewareDefinitions<TParams extends MiddlewareParams, TResults extends MiddlewareResults> = {
  [K in keyof TParams]: MiddlewareDefinition<TParams[K], K extends keyof TResults ? TResults[K] : unknown>;
};

type HookDefinitions<TPayloads extends HookPayloads> = {
  [K in keyof TPayloads]: HookDefinition<TPayloads[K]>;
};

type ExtensionAuthoringDefinition<
  TCommandSchemas extends CommandSchemas,
  TMiddlewareParams extends MiddlewareParams,
  TMiddlewareResults extends MiddlewareResults,
  THookPayloads extends HookPayloads,
  TScheduleParams extends MiddlewareParams,
  TSettings extends ExtensionSettingsContribution<SettingProperties> | undefined,
> = Omit<ExtensionDefinition, "commands" | "middlewares" | "hooks" | "schedules" | "settings"> & {
  settings?: TSettings;
  commands?: CommandDefinitions<TCommandSchemas, SettingsMap<TSettings>>;
  middlewares?: MiddlewareDefinitions<TMiddlewareParams, TMiddlewareResults>;
  hooks?: HookDefinitions<THookPayloads>;
  schedules?: {
    [K in keyof TScheduleParams]: ScheduleContribution<TScheduleParams[K]>;
  };
};

/**
 * Identity helper that types the passed contributions. Authors get autocomplete on
 * contributions. Extension identity (id, name, version, description, publisher,
 * engines.pstdio) lives in package.json.
 *
 * @example
 *   export default defineExtension({
 *     commands: { ... },
 *   });
 */
// identity — exists for type inference
export const defineExtension = <
  const TCommandSchemas extends CommandSchemas = EmptyMap,
  const TMiddlewareParams extends MiddlewareParams = EmptyMap,
  const TMiddlewareResults extends MiddlewareResults = MiddlewareResults,
  const THookPayloads extends HookPayloads = EmptyMap,
  const TScheduleParams extends MiddlewareParams = EmptyMap,
  const TSettings extends ExtensionSettingsContribution<SettingProperties> | undefined = undefined,
>(
  extension: ExtensionAuthoringDefinition<
    TCommandSchemas,
    TMiddlewareParams,
    TMiddlewareResults,
    THookPayloads,
    TScheduleParams,
    TSettings
  >,
): ExtensionAuthoringDefinition<
  TCommandSchemas,
  TMiddlewareParams,
  TMiddlewareResults,
  THookPayloads,
  TScheduleParams,
  TSettings
> &
  ExtensionDefinition => extension;
