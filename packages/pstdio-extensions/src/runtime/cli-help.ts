import type { ExtensionRuntime, RuntimeCliContribution } from "../types/runtime";

export type CliHelpNode = {
  segment: string;
  /** Full path key from the extension prefix down to this node, e.g. "planner tickets create". */
  pathKey: string;
  command?: RuntimeCliContribution;
  children: CliHelpNode[];
};

const ensureChild = (parent: CliHelpNode, segment: string, pathKeyParts: string[]) => {
  let child = parent.children.find((candidate) => candidate.segment === segment);
  if (!child) {
    child = { segment, pathKey: pathKeyParts.join(" "), children: [] };
    parent.children.push(child);
    parent.children.sort((a, b) => a.segment.localeCompare(b.segment));
  }
  return child;
};

/**
 * Build a tree of CLI commands grouped by extension package name. Pure read of the
 * runtime registry. Useful for rendering `pstdio --help` or a dashboard CLI explorer.
 */
export const buildCliHelpTree = (runtime: Pick<ExtensionRuntime, "cli">): CliHelpNode[] => {
  const roots = new Map<string, CliHelpNode>();

  for (const cli of runtime.cli) {
    if (cli.hidden) continue;

    let root = roots.get(cli.name);
    if (!root) {
      root = { segment: cli.name, pathKey: cli.name, children: [] };
      roots.set(cli.name, root);
    }

    let cursor = root;
    const parts = [cli.name];
    for (const segment of cli.path) {
      parts.push(segment);
      cursor = ensureChild(cursor, segment, parts);
    }
    cursor.command = cli;
  }

  return Array.from(roots.values()).sort((a, b) => a.segment.localeCompare(b.segment));
};
