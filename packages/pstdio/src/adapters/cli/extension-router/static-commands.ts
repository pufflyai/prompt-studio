import { topLevelCommandModules } from "@/adapters/cli/commands";

const isCommandModuleLike = (mod: unknown): mod is { command: string | string[] } =>
  typeof mod === "object" && mod !== null && "command" in mod;

const extractFirstSegment = (commandSpec: string): string | undefined => {
  const trimmed = commandSpec.trim();
  if (trimmed.length === 0 || trimmed === "$0") return undefined;
  return trimmed.split(/\s+/)[0];
};

const segmentsFromCommand = (mod: { command: string | string[] }): string[] => {
  const specs = Array.isArray(mod.command) ? mod.command : [mod.command];
  const segments: string[] = [];
  for (const spec of specs) {
    if (typeof spec !== "string") continue;
    const segment = extractFirstSegment(spec);
    if (segment) segments.push(segment);
  }
  return segments;
};

/**
 * Top-level static command segments registered by the kernel CLI.
 * Used for collision detection against extension namespaces.
 */
export const getStaticCommandNames = (): Set<string> => {
  const names = new Set<string>();
  for (const mod of topLevelCommandModules) {
    if (!isCommandModuleLike(mod)) continue;
    for (const segment of segmentsFromCommand(mod)) names.add(segment);
  }
  return names;
};
