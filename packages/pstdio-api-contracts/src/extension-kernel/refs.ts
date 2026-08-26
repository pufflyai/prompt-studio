import type { CommandRef } from "./types/commands";
import type { EventRef } from "./types/events";
import type { Struct } from "./types/json";

interface ExternalRefInput {
  extensionId: string;
  id: string;
}

interface ExtensionOwner {
  publisher: string;
  name: string;
}

interface CommandRefFactory {
  <TParams extends Struct = Struct, TResult = unknown>(input: ExternalRefInput): CommandRef<TParams, TResult>;
  forExtension(
    owner: ExtensionOwner,
  ): <TParams extends Struct = Struct, TResult = unknown>(id: string) => CommandRef<TParams, TResult>;
}

const createCommandRef = <TParams extends Struct = Struct, TResult = unknown>(
  input: ExternalRefInput,
): CommandRef<TParams, TResult> => ({ ...input, kind: "command" });

/** Build a typed cross-extension command reference. */
export const commandRef: CommandRefFactory = Object.assign(createCommandRef, {
  forExtension:
    (owner: ExtensionOwner) =>
    <TParams extends Struct = Struct, TResult = unknown>(id: string): CommandRef<TParams, TResult> =>
      createCommandRef({ extensionId: `${owner.publisher}.${owner.name}`, id }),
});

/** Build a typed event reference from separate ownership and local identity. */
export const eventRef = <TPayload extends Struct = Struct>(input: ExternalRefInput): EventRef<TPayload> => ({
  ...input,
  kind: "event",
});
