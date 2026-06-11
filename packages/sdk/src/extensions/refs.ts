import type {
  CommandDefinition,
  CommandLifecycleEventPayload,
  CommandLifecyclePhase,
  CommandRef,
  EventRef,
  ParamObjectSchema,
  ParamsOf,
  Struct,
} from "pstdio-api-contracts/extension-kernel";

export { commandRef, eventRef } from "pstdio-api-contracts/extension-kernel";

/**
 * Build an `EventRef` for a command lifecycle phase (`requested`, `started`, `completed`,
 * `rejected`, `failed`). The payload type is inferred from the command ref so hooks see
 * the correct shape.
 */
export const commandEvent = <TPhase extends CommandLifecyclePhase, TParams extends Struct = Struct, TResult = unknown>(
  command: CommandRef<TParams, TResult>,
  phase: TPhase,
): EventRef<CommandLifecycleEventPayload<TPhase, TParams, TResult>> => ({
  id: `command.${phase}:${command.id}`,
});

// biome-ignore lint/suspicious/noExplicitAny: index signature must accept any command shape
type CommandsRecord = Record<string, CommandDefinition<any, any, any>>;

type CommandRefFromDefinition<TDefinition> =
  TDefinition extends CommandDefinition<infer TSchema, infer TResult, infer _TSettings>
    ? CommandRef<TSchema extends ParamObjectSchema ? ParamsOf<TSchema> : Struct, TResult>
    : never;

type CommandsRefMap<TCommands extends CommandsRecord> = {
  [K in keyof TCommands]: CommandRefFromDefinition<TCommands[K]>;
};

/**
 * Derive typed `CommandRef`s from an extension contribution object. Renaming a
 * command in the definition surfaces as a type error wherever the ref is used.
 *
 * The package name is explicit because identity now lives in package.json, not in
 * `defineExtension()`.
 *
 * @example
 *   const ext = defineExtension({ commands: { ... } });
 *   const labCommands = commandsOf("extension-lab", ext);
 *   labCommands.awaken; // CommandRef<{ title?: string }, ...>
 */
export const commandsOf = <TExtension extends { commands?: CommandsRecord }>(
  packageName: string,
  extension: TExtension,
): CommandsRefMap<NonNullable<TExtension["commands"]>> => {
  const refs: Record<string, CommandRef> = {};
  const commands = extension.commands ?? {};
  for (const key of Object.keys(commands)) {
    refs[key] = { id: `${packageName}.${key}` };
  }
  return refs as CommandsRefMap<NonNullable<TExtension["commands"]>>;
};
