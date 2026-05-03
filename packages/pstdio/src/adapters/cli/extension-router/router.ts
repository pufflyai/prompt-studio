import type { CliHelpNode } from "pstdio-extensions";
import { type CliCollisionsReport, formatCollisionsReport } from "./collisions";
import { checkExtensionAvailability, findRecoveryHint, formatRecoveryMessage } from "./recovery";
import type { LoadedCliTree } from "./tree";

const isOptionToken = (arg: string) => arg.startsWith("-");

export const extractPositionalTokens = (rawArgs: string[]): string[] => {
  const tokens: string[] = [];
  let skipNext = false;
  for (const arg of rawArgs) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (!isOptionToken(arg)) {
      tokens.push(arg);
      continue;
    }
    // Conservatively skip a value following short flags like `--amount 2`. We can't
    // perfectly disambiguate without yargs config, but recovery only needs the
    // first few positional tokens, so we err on the side of fewer tokens.
    if (arg.startsWith("--") && arg.includes("=")) continue;
    skipNext = true;
  }
  return tokens;
};

const isPathRegisteredInTree = (tokens: string[], tree: CliHelpNode[]): boolean => {
  if (tokens.length === 0) return false;
  let nodes: CliHelpNode[] = tree;
  for (const token of tokens) {
    const next: CliHelpNode | undefined = nodes.find((n) => n.segment === token);
    if (!next) return false;
    nodes = next.children;
  }
  return true;
};

const isFirstSegmentExtensionNamespace = (token: string, tree: CliHelpNode[]) =>
  tree.some((root) => root.segment === token);

export const isPathRegistered = (tokens: string[], tree: CliHelpNode[], staticNames: Set<string>): boolean => {
  if (tokens.length === 0) return false;
  if (staticNames.has(tokens[0])) return true;
  if (!isFirstSegmentExtensionNamespace(tokens[0], tree)) return false;
  // The full path must resolve in the extension tree; otherwise yargs would error inside the namespace.
  return isPathRegisteredInTree(tokens, tree);
};

type CollisionMatch = {
  tokens: string[];
  pathKey: string;
};

const findCollisionMatch = (tokens: string[], collisions: CliCollisionsReport): CollisionMatch | undefined => {
  // Walk longest-prefix-first so deeper collisions take precedence.
  for (let n = tokens.length; n > 0; n--) {
    const prefix = tokens.slice(0, n);
    const pathKey = prefix.join(" ");
    if (collisions.refusedPathKeys.has(pathKey)) {
      return { tokens: prefix, pathKey };
    }
  }
  return undefined;
};

export type RouterIntervention =
  | { kind: "collision"; output: string }
  | { kind: "recovery"; output: string }
  | { kind: "none" };

export const decideRouterIntervention = (rawArgs: string[], loaded: LoadedCliTree): RouterIntervention => {
  const tokens = extractPositionalTokens(rawArgs);

  const collisionMatch = findCollisionMatch(tokens, loaded.collisions);
  if (collisionMatch) {
    return { kind: "collision", output: formatCollisionsReport(loaded.collisions) };
  }

  if (tokens.length === 0) return { kind: "none" };
  if (isPathRegistered(tokens, loaded.tree, loaded.staticNames)) return { kind: "none" };

  const hint = findRecoveryHint(tokens);
  if (!hint) return { kind: "none" };

  const availability = checkExtensionAvailability(loaded.runtime, hint.providerId);
  const status = availability.installed ? "installed-disabled" : "missing";
  const invokedPath = tokens.slice(0, hint.path.length);
  const output = formatRecoveryMessage({ hint, invokedPath, status });
  return { kind: "recovery", output };
};
