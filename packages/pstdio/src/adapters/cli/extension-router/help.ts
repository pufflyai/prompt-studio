import type { CliHelpNode, RuntimeCliContribution, RuntimeCommandRecord } from "pstdio-extensions";

export type CommandLookup = (commandId: string) => RuntimeCommandRecord | undefined;

const labelFor = (cli?: RuntimeCliContribution) => cli?.description;

export const namespaceHeader = (root: CliHelpNode, lookup: CommandLookup): string => {
  const provider = collectProviderId(root, lookup);
  const lines = [`pstdio ${root.segment}`, ""];
  lines.push(`Extension namespace: ${root.segment}`);
  if (provider) lines.push(`Provider: ${provider}`);
  return lines.join("\n");
};

const collectProviderId = (root: CliHelpNode, lookup: CommandLookup): string | undefined => {
  const seen = new Set<string>();
  walk(root, (node) => {
    if (node.command) {
      const record = lookup(node.command.commandId);
      if (record) seen.add(record.extensionId);
    }
  });
  if (seen.size === 1) {
    const [only] = seen;
    return only;
  }
  return undefined;
};

const walk = (node: CliHelpNode, visit: (n: CliHelpNode) => void) => {
  visit(node);
  for (const child of node.children) walk(child, visit);
};

export const buildCommandEpilog = (
  contribution: RuntimeCliContribution,
  record: RuntimeCommandRecord | undefined,
): string => {
  const lines: string[] = [];
  lines.push("Provider:");
  lines.push(`  ${contribution.extensionId}`);
  lines.push("");
  lines.push("Command:");
  lines.push(`  ${contribution.commandId}`);
  if (record?.sourcePath) {
    lines.push("");
    lines.push("Source:");
    lines.push(`  ${record.sourcePath}`);
  }
  return lines.join("\n");
};

export const buildLeafDescribe = (record: RuntimeCommandRecord | undefined, contribution: RuntimeCliContribution) => {
  const desc = labelFor(contribution) ?? record?.description ?? record?.title;
  return desc ?? `Run ${contribution.commandId}`;
};

export const buildBranchDescribe = (node: CliHelpNode) => `${node.pathKey} commands`;
