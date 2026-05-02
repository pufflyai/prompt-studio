import type { CommandLifecycleEventPayload, CommandLifecyclePhase, CommandRef } from "./types/commands";
import type { EventRef } from "./types/events";
import type { Struct } from "./types/json";

export const commandRef = <TParams extends Struct = Struct, TResult = unknown>(
  id: string,
): CommandRef<TParams, TResult> => ({ id });

export const eventRef = <TPayload extends Struct = Struct>(id: string): EventRef<TPayload> => ({ id });

export const commandEvent = <TPhase extends CommandLifecyclePhase, TParams extends Struct = Struct, TResult = unknown>(
  command: CommandRef<TParams, TResult> | string,
  phase: TPhase,
): EventRef<CommandLifecycleEventPayload<TPhase, TParams, TResult>> => {
  const commandId = typeof command === "string" ? command : command.id;
  return { id: `command.${phase}:${commandId}` };
};
