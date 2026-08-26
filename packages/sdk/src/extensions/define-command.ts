import type {
  CommandDefinition,
  ContributionDefinition,
  HookDefinition,
  MiddlewareDefinition,
  ParamObjectSchema,
  Struct,
} from "pstdio-api-contracts/extension-kernel";

type CommandContribution<TSchema extends ParamObjectSchema | undefined, TResult> = CommandDefinition<TSchema, TResult> &
  ContributionDefinition<"command">;
type CommandInput<TSchema extends ParamObjectSchema | undefined, TResult> = Omit<
  CommandDefinition<TSchema, TResult>,
  "ref"
>;

/**
 * Define a single command outside an extension's object literal. Use this when commands
 * grow large enough to split into separate files, or when you need to share a command
 * shape across extensions. The `params` schema drives the inferred shape of the
 * handler's second argument.
 *
 * @example
 *   export const sayHello = defineCommand({
 *     title: "Say hello",
 *     params: { name: params.text({ required: true }) },
 *     async run(ctx, commandParams) {
 *       commandParams.name; // string
 *     },
 *   });
 */
export function defineCommand<const TSchema extends ParamObjectSchema | undefined, TResult>(
  definition: CommandInput<TSchema, TResult>,
): CommandContribution<TSchema, TResult>;
export function defineCommand<const TSchema extends ParamObjectSchema | undefined, TResult>(
  definition: CommandInput<TSchema, TResult>,
) {
  return { ...definition, ref: { kind: "command" as const, id: definition.id } };
}

/**
 * Define middleware for a command.
 */
export const defineMiddleware = <TParams extends Struct = Struct, TResult = unknown>(
  definition: Omit<MiddlewareDefinition<TParams, TResult>, "ref">,
): MiddlewareDefinition<TParams, TResult> => ({
  ...definition,
  ref: { kind: "middleware", id: definition.id },
});

/**
 * Define a hook for an event.
 */
export const defineHook = <TPayload extends Struct = Struct>(
  definition: Omit<HookDefinition<TPayload>, "ref">,
): HookDefinition<TPayload> => ({
  ...definition,
  ref: { kind: "hook", id: definition.id },
});
