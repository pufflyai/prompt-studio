import type { CommandDefinition, HookDefinition, MiddlewareDefinition } from "./types/extension";
import type { Struct } from "./types/json";
import type { ParamObjectSchema } from "./types/params";

/**
 * Define a single command outside an extension's object literal. Use this when commands
 * grow large enough to split into separate files, or when you need to share a command
 * shape across extensions. The `params` schema drives the inferred shape of `ctx.params`.
 *
 * @example
 *   export const sayHello = defineCommand({
 *     title: "Say hello",
 *     params: { name: params.text({ required: true }) },
 *     async run(ctx) {
 *       ctx.params.name; // string
 *     },
 *   });
 */
export const defineCommand = <const TSchema extends ParamObjectSchema | undefined, TResult = unknown>(
  definition: CommandDefinition<TSchema, TResult>,
): CommandDefinition<TSchema, TResult> => definition;

/**
 * Define middleware for a command. Pass the typed `command` ref (preferred) or
 * `commandId` for cross-extension references where the typed ref isn't importable.
 */
export const defineMiddleware = <TParams extends Struct = Struct, TResult = unknown>(
  definition: MiddlewareDefinition<TParams, TResult>,
): MiddlewareDefinition<TParams, TResult> => definition;

/**
 * Define a hook for an event. Pass the typed `event` ref (preferred) or `eventId` for
 * cross-extension references where the typed ref isn't importable.
 */
export const defineHook = <TPayload extends Struct = Struct>(
  definition: HookDefinition<TPayload>,
): HookDefinition<TPayload> => definition;
