import type { ExtensionDefinition } from "./types/extension";

export const defineExtension = <const TExtension extends ExtensionDefinition>(extension: TExtension): TExtension =>
  extension;
