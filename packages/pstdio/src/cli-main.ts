import yargs from "yargs";
import { topLevelCommandModules, topLevelCommandNames } from "./adapters/cli/commands";
import * as dashboardCommand from "./adapters/cli/commands/dashboard";
import { shouldEnsureApiForCommand } from "./features/cli-api-startup";
import { CLI_VERSION } from "./features/cli-version";
import { findProjectRoot, readConfig } from "./features/config/config";
import { ensureApi } from "./features/ensure-api";
import { dispatchExtensionCliCommand } from "./features/extensions/extension-cli-router";
import {
  firstCommandToken,
  rawValueFor,
  shouldDispatchExtensionCommand,
} from "./features/extensions/extension-command-routing";
import { loadExtensionNamespaces } from "./features/extensions/root-help-namespaces";
import { resolveRootHelpRuntime } from "./features/extensions/root-help-runtime";
import { createCliCommandTracker } from "./features/logging/cli-command-log";
import { resolveCliSessionId } from "./features/sessions/resolve-cli-session-id";
import { shouldLoadEmbedManifest } from "./features/should-load-embed-manifest";

type CommandTracker = ReturnType<typeof createCliCommandTracker>;

// True-core commands only. Domain namespaces (the ticket board's
// tickets/statuses/tags) are not listed here — they resolve entirely through
// extension-contributed commands.
const staticTopLevelCommands = new Set(["dashboard", ...topLevelCommandNames]);

const hasProjectConfig = () => {
  const root = findProjectRoot(process.cwd());
  return Boolean(root && readConfig(root));
};

const createArgHelpers = (rawArgs: string[]) => {
  const resolveRequestedApiUrl = () => {
    if (process.env.PSTDIO_API_URL) return process.env.PSTDIO_API_URL;
    const apiPort = rawValueFor(rawArgs, "api-port");
    return apiPort ? `http://127.0.0.1:${apiPort}` : undefined;
  };

  const applyApiPortFromArgs = () => {
    if (process.env.PSTDIO_API_URL || process.env.PSTDIO_API_PORT) return;
    const apiPort = rawValueFor(rawArgs, "api-port");
    if (apiPort) process.env.PSTDIO_API_PORT = apiPort;
  };

  return { applyApiPortFromArgs, resolveRequestedApiUrl };
};

type ArgHelpers = ReturnType<typeof createArgHelpers>;

/**
 * Route unknown top-level tokens to the extension CLI router. Returns `true`
 * when the command was handled (the process has already exited by then);
 * `false` means fall through to yargs.
 */
const tryDispatchExtensionCommand = async (
  rawArgs: string[],
  helpers: ArgHelpers,
  commandTracker: CommandTracker,
): Promise<boolean> => {
  if (!shouldDispatchExtensionCommand({ rawArgs, staticTopLevelCommands, hasProjectConfig })) return false;

  try {
    helpers.applyApiPortFromArgs();
    await ensureApi(helpers.resolveRequestedApiUrl());
    commandTracker.captureArgv({ _: rawArgs });
    const exitCode = await dispatchExtensionCliCommand({
      rawArgs,
      onCommandResolved: (command) => {
        commandTracker.setMutating(command.mutating === true);
        commandTracker.logStart();
      },
    });

    // A null exit code means the token was not an extension namespace; fall
    // through to yargs so root help/error formatting stays canonical.
    if (exitCode === null) return false;

    if (exitCode === 0) commandTracker.logSuccess();
    else commandTracker.logFailure(`Extension command exited with status ${exitCode}`);
    process.exit(exitCode);
  } catch (error) {
    // When extension metadata is unavailable, let yargs keep the normal root
    // help for unknown commands.
    if (error instanceof Error && error.message.startsWith("Could not start the pstdio API.")) return false;

    commandTracker.logFailure(error);
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }
};

const buildCli = (rawArgs: string[], helpers: ArgHelpers, commandTracker: CommandTracker) => {
  const cli = yargs(rawArgs)
    .scriptName("pstdio")
    .version(CLI_VERSION)
    .strict()
    .fail((msg, err, yargs) => {
      commandTracker.logFailure(err ?? msg);
      if (err) {
        process.stderr.write(`Error: ${err.message}\n`);
        process.exit(1);
      }
      process.stderr.write(`${msg}\n\n`);
      yargs.showHelp("error");
      process.stderr.write("\n");
      process.exit(1);
    })
    .middleware(async (argv) => {
      commandTracker.captureArgv(argv);
      commandTracker.logStart();

      if (!shouldEnsureApiForCommand(argv)) return;

      helpers.applyApiPortFromArgs();
      await ensureApi(helpers.resolveRequestedApiUrl());
    })
    .command(dashboardCommand);

  for (const mod of topLevelCommandModules) {
    // biome-ignore lint/suspicious/noExplicitAny: yargs CommandModule union requires cast
    cli.command(mod as any);
  }

  return cli;
};

/**
 * Surface extension namespaces (e.g. `tickets`) alongside core commands in the
 * root help. API-gated and best-effort: when the server is reachable we list the
 * installed namespaces, otherwise root help degrades to core commands only.
 */
const augmentRootHelpWithNamespaces = async (
  cli: ReturnType<typeof buildCli>,
  rawArgs: string[],
  helpers: ArgHelpers,
) => {
  if (firstCommandToken(rawArgs) || !(rawArgs.includes("--help") || rawArgs.includes("-h"))) return;

  const { apiUrl, token } = await resolveRootHelpRuntime(helpers.resolveRequestedApiUrl());
  process.env.PSTDIO_API_URL = apiUrl;
  if (token) process.env.PSTDIO_API_TOKEN = token;

  const namespaces = await loadExtensionNamespaces({
    healthUrl: `${apiUrl}/healthz`,
    exclude: staticTopLevelCommands,
  });
  for (const summary of namespaces) {
    cli.command(`${summary.namespace} [command]`, summary.description);
  }
};

/**
 * Full CLI wiring. Kept behind a dynamic import from `index.ts` so `--version`
 * and other trivial paths don't pay the cost of loading every command module,
 * the API client, and the extension router — which, under `--conditions=source`,
 * means transpiling that whole tree on each invocation.
 */
export const runCli = async (rawArgs: string[]) => {
  if (shouldLoadEmbedManifest()) {
    // Side-effect import: registers files for Bun.embeddedFiles in compiled binaries.
    // Generated by build scripts.
    await import("./_embed-manifest.generated");
  }

  const helpers = createArgHelpers(rawArgs);
  const commandTracker = createCliCommandTracker({
    rawArgs,
    sessionId: resolveCliSessionId({ env: process.env }),
  });

  if (await tryDispatchExtensionCommand(rawArgs, helpers, commandTracker)) return;

  const cli = buildCli(rawArgs, helpers, commandTracker);
  await augmentRootHelpWithNamespaces(cli, rawArgs, helpers);

  await cli
    .parseAsync()
    .then(() => {
      commandTracker.logSuccess();
    })
    .catch((error: unknown) => {
      commandTracker.logFailure(error);
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    });
};
