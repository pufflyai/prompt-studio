import type { EventDefinition, ExtensionDefinition, ResourceDefinition, SlotDefinition } from "./types";

const assertCommandHandlers = (extension: ExtensionDefinition) => {
  for (const [key, command] of Object.entries(extension.commands ?? {})) {
    if (typeof command.run === "function") continue;

    throw new Error(`Extension command "${key}" is missing run(ctx)`);
  }
};

const assertLifecycleHandlers = (extension: ExtensionDefinition) => {
  if (extension.initialSetup !== undefined && typeof extension.initialSetup !== "function") {
    throw new Error(`Extension "${extension.id}" initialSetup must be a function`);
  }

  if (extension.migrate !== undefined && typeof extension.migrate !== "function") {
    throw new Error(`Extension "${extension.id}" migrate must be a function`);
  }
};

export const defineExtension = <TDefinition extends ExtensionDefinition>(extension: TDefinition) => {
  assertCommandHandlers(extension);
  assertLifecycleHandlers(extension);
  return extension;
};

export const defineSlot = <TSlot extends SlotDefinition>(slot: TSlot) => slot;

export const defineEvent = <TPayload = Record<string, unknown>>(event: EventDefinition<TPayload>) => event;

export const defineResource = <TResource extends ResourceDefinition>(resource: TResource) => resource;
