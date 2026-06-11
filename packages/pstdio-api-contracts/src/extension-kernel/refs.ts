import type { CommandRef } from "./types/commands";
import type { EventRef } from "./types/events";
import type { Struct } from "./types/json";

/**
 * Build a typed reference to a command by id. Authors generally prefer
 * `commandsOf(packageName, ext)` from @pstdio/sdk, which derives refs from the
 * extension definition so a renamed command becomes a type error at every call site.
 */
export const commandRef = <TParams extends Struct = Struct, TResult = unknown>(
  id: string,
): CommandRef<TParams, TResult> => ({ id });

/** Build a typed reference to an event by id. */
export const eventRef = <TPayload extends Struct = Struct>(id: string): EventRef<TPayload> => ({ id });
