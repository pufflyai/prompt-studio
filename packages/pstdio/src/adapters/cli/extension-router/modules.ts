import type { CliHelpNode, RuntimeCommandRecord } from "pstdio-extensions";
import type { Argv, CommandModule } from "yargs";
import { dispatchCommand, type ExtensionCommandDeps } from "./dispatch";
import {
  buildBranchDescribe,
  buildCommandEpilog,
  buildLeafDescribe,
  type CommandLookup,
  namespaceHeader,
} from "./help";

export type BuildModulesInput = {
  deps: ExtensionCommandDeps;
  tree: CliHelpNode[];
  /** Lookup full runtime command record (for descriptions, source paths). */
  commandLookup: CommandLookup;
  /** Path keys whose execution must be refused due to collisions. */
  refusedPathKeys?: Set<string>;
};

const buildLeafModule = (input: BuildModulesInput, node: CliHelpNode): CommandModule => {
  const cli = node.command;
  if (!cli) throw new Error(`Cannot build leaf module without command for ${node.pathKey}`);

  const record = input.commandLookup(cli.commandId);
  const refused = input.refusedPathKeys?.has(cli.pathKey) ?? false;
  const dispatch = dispatchCommand(input.deps);

  return {
    command: node.segment,
    describe: buildLeafDescribe(record, cli),
    builder: (yargs: Argv) => {
      let next = yargs.option("project-id", { type: "string", describe: "Project ID" });
      next = next.strict(false);
      next = next.usage(`pstdio ${cli.pathKey} [options]`);
      next = next.epilogue(buildCommandEpilog(cli, record));
      if (cli.examples?.length) {
        for (const example of cli.examples) next.example(example, "");
      }
      return next;
    },
    handler: async (argv) => {
      if (refused) {
        input.deps.err(`Refusing to run ${cli.commandId}: CLI path "${cli.pathKey}" has unresolved collisions.\n`);
        input.deps.exit(1);
        return;
      }
      await dispatch({ commandId: cli.commandId, extensionId: cli.extensionId, argv: argv as Record<string, unknown> });
    },
  };
};

const buildBranchModule = (input: BuildModulesInput, node: CliHelpNode, isRoot: boolean): CommandModule => {
  return {
    command: node.segment,
    describe: buildBranchDescribe(node),
    builder: (yargs: Argv) => {
      let next = yargs.option("project-id", { type: "string", describe: "Project ID" });
      if (isRoot) {
        next = next.usage(namespaceHeader(node, input.commandLookup));
      }
      for (const child of node.children) {
        next = next.command(buildSubcommand(input, child, false));
      }
      if (node.command) {
        // Branch nodes that ALSO carry a leaf command (rare): execute it when no subcommand provided.
        next = next.strict(false);
      } else {
        // Pure branch nodes must require a subcommand so users see the available paths
        // instead of a silent no-op when invoked without a leaf.
        next = next.demandCommand(
          1,
          `Missing subcommand for "pstdio ${node.pathKey}". Run "pstdio ${node.pathKey} --help" to see available commands.`,
        );
      }
      return next;
    },
    handler: async (argv) => {
      if (!node.command) return;
      const cli = node.command;
      const refused = input.refusedPathKeys?.has(cli.pathKey) ?? false;
      if (refused) {
        input.deps.err(`Refusing to run ${cli.commandId}: CLI path "${cli.pathKey}" has unresolved collisions.\n`);
        input.deps.exit(1);
        return;
      }
      await dispatchCommand(input.deps)({
        commandId: cli.commandId,
        extensionId: cli.extensionId,
        argv: argv as Record<string, unknown>,
      });
    },
  };
};

const buildSubcommand = (input: BuildModulesInput, node: CliHelpNode, isRoot: boolean): CommandModule => {
  if (node.children.length === 0 && node.command) {
    return buildLeafModule(input, node);
  }
  return buildBranchModule(input, node, isRoot);
};

export const buildExtensionCommandModules = (input: BuildModulesInput): CommandModule[] =>
  input.tree.map((root) => buildSubcommand(input, root, true));

export const createCommandLookup = (records: RuntimeCommandRecord[]): CommandLookup => {
  const map = new Map(records.map((record) => [record.id, record]));
  return (id: string) => map.get(id);
};
