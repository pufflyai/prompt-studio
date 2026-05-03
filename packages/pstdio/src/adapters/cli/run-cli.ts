import type { Argv, CommandModule } from "yargs";
import yargs from "yargs";
import { topLevelCommandModules } from "@/adapters/cli/commands";
import * as dashboardCommand from "@/adapters/cli/commands/dashboard";
import { CLI_VERSION } from "@/features/cli-version";
import { createCliCommandTracker } from "@/features/logging/cli-command-log";
import { resolveCliSessionId } from "@/features/sessions/resolve-cli-session-id";
import { ensureCliApi } from "./api-startup";
import { defaultExtensionCommandDeps } from "./extension-router/dispatch";
import { buildExtensionCommandModules, createCommandLookup } from "./extension-router/modules";
import { decideRouterIntervention } from "./extension-router/router";
import { type LoadedCliTree, loadExtensionCliTree } from "./extension-router/tree";

type CliCommandTracker = ReturnType<typeof createCliCommandTracker>;

type RunCliInput = {
  env?: NodeJS.ProcessEnv;
  rawArgs: string[];
};

const registerCommand = (cli: Argv, commandModule: object) => {
  // yargs cannot type a heterogeneous command registry with command-specific handler args.
  cli.command(commandModule as unknown as CommandModule);
};

const exitWithError = (message: string) => {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
};

const configureFailureHandler = (cli: Argv, commandTracker: CliCommandTracker) =>
  cli.fail((msg, err, yargs) => {
    commandTracker.logFailure(err ?? msg);

    if (err) {
      exitWithError(err.message);
      return;
    }

    process.stderr.write(`${msg}\n\n`);
    yargs.showHelp("error");
    process.stderr.write("\n");
    process.exit(1);
  });

const registerCommands = (cli: Argv, extensionModules: CommandModule[]) => {
  registerCommand(cli, dashboardCommand);

  for (const commandModule of topLevelCommandModules) {
    registerCommand(cli, commandModule);
  }

  for (const commandModule of extensionModules) {
    cli.command(commandModule);
  }

  return cli;
};

const createCli = (input: RunCliInput, commandTracker: CliCommandTracker, extensionModules: CommandModule[]) => {
  const cli = yargs(input.rawArgs).scriptName("pstdio").version(CLI_VERSION).strict();
  const withFailureHandler = configureFailureHandler(cli, commandTracker);

  return registerCommands(
    withFailureHandler.middleware(async (argv) => {
      commandTracker.captureArgv(argv);
      commandTracker.logStart();

      await ensureCliApi({ argv, env: input.env ?? process.env });
    }),
    extensionModules,
  );
};

const loadCliTreeSafely = async (): Promise<LoadedCliTree | undefined> => {
  try {
    return await loadExtensionCliTree();
  } catch {
    return undefined;
  }
};

const buildModules = (loaded: LoadedCliTree | undefined): CommandModule[] => {
  if (!loaded) return [];
  const lookup = createCommandLookup(loaded.runtime.commands);
  return buildExtensionCommandModules({
    deps: defaultExtensionCommandDeps,
    tree: loaded.tree,
    commandLookup: lookup,
    refusedPathKeys: loaded.collisions.refusedPathKeys,
  });
};

const interceptIfNeeded = (rawArgs: string[], loaded: LoadedCliTree | undefined): boolean => {
  if (!loaded) return false;
  const decision = decideRouterIntervention(rawArgs, loaded);
  if (decision.kind === "none") return false;
  if (decision.kind === "collision") {
    process.stderr.write(decision.output);
  } else {
    process.stdout.write(decision.output);
  }
  process.exit(1);
};

export const runCli = async (input: RunCliInput) => {
  const env = input.env ?? process.env;
  const commandTracker = createCliCommandTracker({
    rawArgs: input.rawArgs,
    sessionId: resolveCliSessionId({ env }),
  });

  try {
    const loaded = await loadCliTreeSafely();
    if (interceptIfNeeded(input.rawArgs, loaded)) return;

    const extensionModules = buildModules(loaded);
    await createCli({ ...input, env }, commandTracker, extensionModules).parseAsync();
    commandTracker.logSuccess();
  } catch (error) {
    commandTracker.logFailure(error);
    const message = error instanceof Error ? error.message : String(error);
    exitWithError(message);
  }
};
