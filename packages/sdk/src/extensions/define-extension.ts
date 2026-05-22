import type {
  CommandDefinition,
  ExtensionDefinition,
  HookDefinition,
  MiddlewareDefinition,
  ScheduleContribution,
} from "./types/extension";
import type { Struct } from "./types/json";
import type { ParamObjectSchema } from "./types/params";

type CommandSchemas = Record<string, ParamObjectSchema | undefined>;
type MiddlewareParams = Record<string, Struct>;
type MiddlewareResults = Record<string, unknown>;
type HookPayloads = Record<string, Struct>;
type EmptyMap = Record<string, never>;

type CommandDefinitions<TSchemas extends CommandSchemas> = {
  [K in keyof TSchemas]: CommandDefinition<TSchemas[K], unknown>;
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
> = Omit<ExtensionDefinition, "commands" | "middlewares" | "hooks" | "schedules"> & {
  commands?: CommandDefinitions<TCommandSchemas>;
  middlewares?: MiddlewareDefinitions<TMiddlewareParams, TMiddlewareResults>;
  hooks?: HookDefinitions<THookPayloads>;
  schedules?: {
    [K in keyof TScheduleParams]: ScheduleContribution<TScheduleParams[K]>;
  };
};

/**
 * Identity helper that types the passed contributions. Authors get autocomplete on
 * contributions, and `commandsOf(packageName, ext)` can derive typed refs from the
 * returned definition. Extension identity (id, name, version, description, publisher,
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
>(
  extension: ExtensionAuthoringDefinition<
    TCommandSchemas,
    TMiddlewareParams,
    TMiddlewareResults,
    THookPayloads,
    TScheduleParams
  >,
): ExtensionAuthoringDefinition<
  TCommandSchemas,
  TMiddlewareParams,
  TMiddlewareResults,
  THookPayloads,
  TScheduleParams
> &
  ExtensionDefinition => extension;
