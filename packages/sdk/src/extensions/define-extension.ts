import type { ExtensionDefinition } from "./types/extension";

/**
 * Identity helper that preserves the literal type of the passed extension. Authors get
 * full autocomplete on contributions, and `commandsOf(ext)` can derive typed refs from
 * the returned definition.
 *
 * @example
 *   export default defineExtension({
 *     id: "pstdio.example",
 *     namespace: "example",
 *     name: "Example",
 *     apiVersion: "1",
 *     commands: { ... },
 *   });
 */
// identity — exists for type inference
export const defineExtension = <const TExtension extends ExtensionDefinition>(extension: TExtension): TExtension =>
  extension;
