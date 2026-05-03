import type { CommandOutcome } from "@pstdio/sdk/extensions";
import type { CommandExecuteRequest } from "pstdio-api-contracts";
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

export const extractParams = (argv: Record<string, unknown>): Record<string, unknown> => {
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(argv)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (value === undefined) continue;
    params[key] = value;
  }
  return params;
};

const formatSuccess = (commandId: string, outcome: Extract<CommandOutcome, { status: "success" }>) => {
  const lines: string[] = [];
  lines.push(`Command ${commandId} completed`);
  lines.push("");
  lines.push(JSON.stringify(outcome.value ?? null, null, 2));
  return `${lines.join("\n")}\n`;
};

const formatRejected = (commandId: string, outcome: Extract<CommandOutcome, { status: "rejected" }>) => {
  const lines: string[] = [];
  lines.push(`Command ${commandId} rejected`);
  if (outcome.code) lines.push(`  code: ${outcome.code}`);
  lines.push(`  reason: ${outcome.reason}`);
  return `${lines.join("\n")}\n`;
};

const formatError = (commandId: string, extensionId: string, outcome: Extract<CommandOutcome, { status: "error" }>) => {
  const lines: string[] = [];
  lines.push(`Command ${commandId} failed`);
  lines.push("");
  lines.push("Provider:");
  lines.push(`  ${extensionId}`);
  if (outcome.code) lines.push(`  code: ${outcome.code}`);
  lines.push(`  reason: ${outcome.reason}`);
  return `${lines.join("\n")}\n`;
};

export const formatOutcome = (commandId: string, extensionId: string, outcome: CommandOutcome): string => {
  if (outcome.status === "success") return formatSuccess(commandId, outcome);
  if (outcome.status === "rejected") return formatRejected(commandId, outcome);
  return formatError(commandId, extensionId, outcome);
};

const exitCodeFor = (outcome: CommandOutcome) => (outcome.status === "success" ? 0 : 1);

export type DispatchInput = {
  commandId: string;
  extensionId: string;
  argv: Record<string, unknown>;
};

export const dispatchCommand = (deps: ExtensionCommandDeps) => async (input: DispatchInput) => {
  const { commandId, extensionId, argv } = input;
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
    deps.log(formatOutcome(commandId, extensionId, result.outcome));
    const code = exitCodeFor(result.outcome);
    if (code !== 0) deps.exit(code);
  } catch (error) {
    deps.err(`${error instanceof Error ? error.message : String(error)}\n`);
    deps.exit(1);
  }
};

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
