import type { ExtensionDefinition } from "./types/extension";

type ExactExtensionDefinition<TExtension extends ExtensionDefinition> = TExtension &
  Record<Exclude<keyof TExtension, keyof ExtensionDefinition>, never>;

/**
 * Identity helper that preserves the literal type of the passed contributions. Authors
 * get full autocomplete on contributions, and `commandsOf(packageName, ext)` can derive typed refs
 * from the returned definition. Extension identity (id, name, version, description,
 * publisher, engines.pstdio) lives in package.json.
 *
 * @example
 *   export default defineExtension({
 *     commands: { ... },
 *   });
 */
// identity — exists for type inference
export const defineExtension = <const TExtension extends ExtensionDefinition>(
  extension: ExactExtensionDefinition<TExtension>,
): TExtension => extension;
