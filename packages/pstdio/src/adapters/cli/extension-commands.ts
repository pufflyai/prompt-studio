import type { CommandOutcome } from "@pstdio/sdk/extensions";
import type { CommandExecuteRequest } from "pstdio-api-contracts";
import { buildCliHelpTree, type CliHelpNode, checkExtensions } from "pstdio-extensions";
import type { Argv, CommandModule } from "yargs";
import { apiClient } from "@/features/api-client";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export type ExtensionCommandDeps = {
  cwd: () => string;
  resolveProjectId: typeof resolveProjectId;
  execute: (commandId: string, body: CommandExecuteRequest) => Promise<{ outcome: CommandOutcome }>;
  log: (msg: string) => void;
  err: (msg: string) => void;
  exit: (code: number) => void;
};

const RESERVED_KEYS = new Set(["_", "$0", "project-id", "projectId", "api-port", "apiPort"]);

const extractParams = (argv: Record<string, unknown>): Record<string, unknown> => {
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(argv)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (value === undefined) continue;
    params[key] = value;
  }
  return params;
};

const formatOutcome = (commandId: string, outcome: CommandOutcome): string => {
  const lines: string[] = [];
  if (outcome.status === "success") {
    lines.push(`Command ${commandId} completed`);
    lines.push("");
    lines.push(JSON.stringify(outcome.value ?? null, null, 2));
  } else if (outcome.status === "rejected") {
    lines.push(`Command ${commandId} rejected`);
    if (outcome.code) lines.push(`  code: ${outcome.code}`);
    lines.push(`  reason: ${outcome.reason}`);
  } else {
    lines.push(`Command ${commandId} failed`);
    if (outcome.code) lines.push(`  code: ${outcome.code}`);
    lines.push(`  reason: ${outcome.reason}`);
  }
  return `${lines.join("\n")}\n`;
};

const exitCodeFor = (outcome: CommandOutcome) => (outcome.status === "success" ? 0 : 1);

const dispatchHandler = (deps: ExtensionCommandDeps, commandId: string) => async (argv: Record<string, unknown>) => {
  let projectId: string;
  try {
    const explicit = typeof argv["project-id"] === "string" ? (argv["project-id"] as string) : undefined;
    projectId = deps.resolveProjectId(deps.cwd(), explicit).projectId;
  } catch (error) {
    deps.err(`${error instanceof Error ? error.message : String(error)}\n`);
    deps.exit(1);
    return;
  }

  const params = extractParams(argv);

  try {
    const result = await deps.execute(commandId, { projectId, params, source: "cli" });
    deps.log(formatOutcome(commandId, result.outcome));
    const code = exitCodeFor(result.outcome);
    if (code !== 0) deps.exit(code);
  } catch (error) {
    deps.err(`${error instanceof Error ? error.message : String(error)}\n`);
    deps.exit(1);
  }
};

const buildSubcommand = (deps: ExtensionCommandDeps, node: CliHelpNode): CommandModule => {
  const handler = node.command ? dispatchHandler(deps, node.command.commandId) : undefined;
  const isLeaf = node.children.length === 0 && handler !== undefined;
  return {
    command: node.segment,
    describe: node.command?.description ?? `${node.pathKey} commands`,
    builder: (yargs: Argv) => {
      let next = yargs.option("project-id", { type: "string", describe: "Project ID" });
      // Leaf extension commands accept arbitrary --flag values as command params,
      // so opt out of strict mode for them; intermediate nodes stay strict.
      if (isLeaf) next = next.strict(false);
      for (const child of node.children) {
        next = next.command(buildSubcommand(deps, child));
      }
      return next;
    },
    handler: handler ?? (() => {}),
  };
};

export const buildExtensionCommandModules = (
  deps: ExtensionCommandDeps,
  cli: ReturnType<typeof buildCliHelpTree>,
): CommandModule[] => cli.map((root) => buildSubcommand(deps, root));

export const defaultExtensionCommandDeps: ExtensionCommandDeps = {
  cwd: () => process.cwd(),
  resolveProjectId,
  execute: async (commandId, body) => {
    const res = await apiClient().extensions.execute(commandId, body);
    return { outcome: res.outcome as CommandOutcome };
  },
  log: (msg) => process.stdout.write(msg),
  err: (msg) => process.stderr.write(msg),
  exit: (code) => process.exit(code),
};

export const loadExtensionCliHelpTree = async () => {
  const result = await checkExtensions({});
  return buildCliHelpTree(result.runtime);
};
