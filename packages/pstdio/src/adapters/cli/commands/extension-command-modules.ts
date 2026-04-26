import type { RuntimeCliContribution } from "@pstdio/sdk/extensions";
import type { ArgumentsCamelCase, CommandModule } from "yargs";

type ExtensionCommandIssueReason =
  | "duplicate_extension_path"
  | "static_command_collision"
  | "unsupported_extension_path";

export type ExtensionCommandIssue = {
  path: string;
  extensionIds: string[];
  commandIds: string[];
  reason: ExtensionCommandIssueReason;
};

type ExtensionNamespaceContribution = RuntimeCliContribution & {
  namespace: string;
  subpath: string;
};

export type ExtensionCommandRegistry = {
  commandModules: CommandModule[];
  unavailableByPath: Map<string, ExtensionCommandIssue>;
};

type RunExtensionCommandFromCli = (input: {
  commandId: string;
  params: Record<string, unknown>;
}) => Promise<unknown> | unknown;

const formatUnavailableReason = (reason: ExtensionCommandIssueReason) => {
  if (reason === "duplicate_extension_path") return "it is defined by multiple extensions";
  if (reason === "unsupported_extension_path") return "its path format is not supported";
  return "it collides with a built-in pstdio command";
};

const formatLeafExample = (example: string) => {
  const normalized = example.trim();
  if (normalized.startsWith("$0 ")) return normalized;
  if (normalized.startsWith("pstdio ")) return normalized;
  return `$0 ${normalized}`;
};

const mapCliParams = (contribution: RuntimeCliContribution, argv: ArgumentsCamelCase) => {
  const params: Record<string, unknown> = {};

  for (const optionName of Object.keys(contribution.options ?? {})) {
    const value = argv[optionName];
    if (value !== undefined) {
      params[optionName] = value;
    }
  }

  return params;
};

const writeCommandResult = (result: unknown) => {
  if (result === undefined || result === null) return;

  const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
};

const toCommandIssue = (input: {
  path: string;
  contributions: RuntimeCliContribution[];
  reason: ExtensionCommandIssueReason;
}): ExtensionCommandIssue => {
  const extensionIds = [...new Set(input.contributions.map((contribution) => contribution.extensionId))].sort();
  const commandIds = [...new Set(input.contributions.map((contribution) => contribution.commandId))].sort();

  return {
    path: input.path,
    extensionIds,
    commandIds,
    reason: input.reason,
  };
};

const createNamespaceHelp = (namespace: string, contributions: ExtensionNamespaceContribution[]) => {
  const lines = ["Extension metadata", `  namespace: ${namespace}`];

  for (const contribution of contributions) {
    lines.push(`  - command: ${contribution.path}`);
    lines.push(`    id: ${contribution.commandId}`);
    lines.push(`    extension: ${contribution.extensionId}`);
    if (contribution.description) lines.push(`    description: ${contribution.description}`);
    for (const example of contribution.examples) {
      lines.push(`    example: ${example}`);
    }
  }

  return lines.join("\n");
};

const createLeafCommandModule = (
  contribution: ExtensionNamespaceContribution,
  runCommand?: RunExtensionCommandFromCli,
): CommandModule => ({
  command: contribution.subpath,
  describe: contribution.description ?? `Extension command: ${contribution.commandId}`,
  builder: (yargs) => {
    let next = yargs;

    if (contribution.options) {
      for (const [optionName, option] of Object.entries(contribution.options)) {
        next = next.option(optionName, {
          type: option.type,
          describe: option.description,
          demandOption: option.required,
          default: option.defaultValue,
        });
      }
    }

    for (const example of contribution.examples) {
      next = next.example(formatLeafExample(example), "");
    }

    return next;
  },
  handler: async (argv) => {
    if (runCommand) {
      const result = await runCommand({
        commandId: contribution.commandId,
        params: mapCliParams(contribution, argv),
      });
      writeCommandResult(result);
      return;
    }

    throw new Error(
      `Extension command "${contribution.path}" is available from "${contribution.extensionId}" but command execution is not enabled yet.`,
    );
  },
});

const createNamespaceCommandModule = (
  namespace: string,
  contributions: ExtensionNamespaceContribution[],
  runCommand?: RunExtensionCommandFromCli,
): CommandModule => {
  let currentArgv: { showHelp: () => void } | null = null;

  return {
    command: `${namespace} [command]`,
    describe: "Commands provided by local extensions",
    builder: (yargs) => {
      currentArgv = yargs;
      let next = yargs;

      for (const contribution of contributions) {
        next = next.command(createLeafCommandModule(contribution, runCommand));
      }

      return next.epilogue(createNamespaceHelp(namespace, contributions));
    },
    handler: () => {
      currentArgv?.showHelp();
    },
  };
};

export const createExtensionCommandRegistry = (input: {
  cli: RuntimeCliContribution[];
  staticTopLevelCommands: string[];
  runCommand?: RunExtensionCommandFromCli;
}): ExtensionCommandRegistry => {
  const staticTopLevelCommands = new Set(input.staticTopLevelCommands);
  const unavailableByPath = new Map<string, ExtensionCommandIssue>();

  const byPath = new Map<string, RuntimeCliContribution[]>();
  for (const contribution of input.cli) {
    const current = byPath.get(contribution.path) ?? [];
    current.push(contribution);
    byPath.set(contribution.path, current);
  }

  const available: RuntimeCliContribution[] = [];
  for (const [path, contributions] of byPath) {
    const namespace = contributions[0]?.pathSegments[0];
    if (!namespace || staticTopLevelCommands.has(namespace)) {
      unavailableByPath.set(
        path,
        toCommandIssue({
          path,
          contributions,
          reason: "static_command_collision",
        }),
      );
      continue;
    }

    if (contributions.length > 1) {
      unavailableByPath.set(
        path,
        toCommandIssue({
          path,
          contributions,
          reason: "duplicate_extension_path",
        }),
      );
      continue;
    }

    const contribution = contributions[0];
    if (contribution.pathSegments.length === 1) {
      unavailableByPath.set(
        path,
        toCommandIssue({
          path,
          contributions,
          reason: "unsupported_extension_path",
        }),
      );
      continue;
    }

    available.push(contribution);
  }

  const byNamespace = new Map<string, ExtensionNamespaceContribution[]>();
  for (const contribution of available) {
    const [namespace, ...rest] = contribution.pathSegments;
    if (!namespace || rest.length === 0) continue;

    const current = byNamespace.get(namespace) ?? [];
    current.push({
      ...contribution,
      namespace,
      subpath: rest.join(" "),
    });
    byNamespace.set(namespace, current);
  }

  const commandModules = [...byNamespace.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([namespace, contributions]) =>
      createNamespaceCommandModule(
        namespace,
        [...contributions].sort((left, right) => left.path.localeCompare(right.path)),
        input.runCommand,
      ),
    );

  return {
    commandModules,
    unavailableByPath,
  };
};

export const formatUnavailableExtensionCommandMessage = (issue: ExtensionCommandIssue) => {
  const extensionList = issue.extensionIds.join(", ");
  const commandList = issue.commandIds.join(", ");

  return [
    `Extension command "${issue.path}" is unavailable because ${formatUnavailableReason(issue.reason)}.`,
    `Extensions: ${extensionList}`,
    `Command ids: ${commandList}`,
    "Run `pstdio extensions check` for diagnostics.",
  ].join("\n");
};
