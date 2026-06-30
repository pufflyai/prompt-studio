import { resolve as resolvePath } from "node:path";
import type {
  CommandExecuteRequest,
  CommandExecuteResponse,
  ExtensionCommandRecord,
  ListExtensionCommandsResponse,
  LocalizableString,
} from "@pstdio/sdk/api";
import type { Repo } from "@pstdio/sdk/resources";
import { apiClient } from "../api-client";
import { resolveOwningRepoRoot as defaultResolveOwningRepoRoot } from "../config/config";
import { resolveProjectId as defaultResolveProjectId } from "../projects/resolve-project-id";

type ParamDescriptor = NonNullable<ExtensionCommandRecord["params"]>[string];
type TranslationRecord = NonNullable<ListExtensionCommandsResponse["translations"]>[number];

export type ExtensionCommandCollision = {
  path: string;
  commands: ExtensionCommandRecord[];
};

export type ExtensionCommandTable = {
  byPath: Map<string, ExtensionCommandRecord>;
  byNamespace: Map<string, ExtensionCommandRecord[]>;
  collisions: ExtensionCommandCollision[];
};

type DispatchDeps = {
  cwd: () => string;
  execute: (commandId: string, request: CommandExecuteRequest) => Promise<CommandExecuteResponse>;
  listCommands: (projectId: string) => Promise<ListExtensionCommandsResponse>;
  listRepos: (projectId: string) => Promise<Repo[]>;
  resolveOwningRepoRoot: (root: string) => string;
  log: (message: string) => void;
  error?: (message: string) => void;
  resolveProjectId: (
    cwd: string,
    explicitId?: string,
  ) => { projectId: string; root: string | null; workspaceId?: string };
};

export const missingCommandHints = new Map([
  ["planner tickets pull", "pstdio.planner"],
  ["planner tickets create", "pstdio.planner"],
]);

const pathParts = (path: string) => path.split(/\s+/).filter(Boolean);

const displayString = (value: LocalizableString | undefined) => {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return value.default ?? value.$l10n;
};

const localeCandidates = (locale: string) => {
  const normalized = locale.replace(/\..*$/, "").replace("_", "-");
  const base = normalized.split("-")[0];
  return Array.from(new Set([normalized, base].filter((candidate): candidate is string => Boolean(candidate))));
};

const processLocale = () => process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG ?? "en";

const resolveTranslatedString = (
  value: LocalizableString | undefined,
  extensionId: string,
  translations: TranslationRecord[],
  locale: string,
) => {
  if (value === undefined || typeof value === "string") return value;
  const record = translations.find((candidate) => candidate.extensionId === extensionId);
  if (!record) return displayString(value);

  for (const candidate of localeCandidates(locale)) {
    const translated = record.bundles[candidate]?.[value.$l10n];
    if (translated !== undefined) return translated;
  }

  return record.bundles[record.defaultLocale]?.[value.$l10n] ?? displayString(value);
};

const localizeCommands = (
  commands: ExtensionCommandRecord[],
  translations: TranslationRecord[],
  locale: string,
): ExtensionCommandRecord[] =>
  commands.map((command) => ({
    ...command,
    title: resolveTranslatedString(command.title, command.extensionId, translations, locale) ?? command.id,
    description: resolveTranslatedString(command.description, command.extensionId, translations, locale),
  }));

const commandCliPaths = (command: ExtensionCommandRecord) => {
  const paths = [command.cliPath, ...(command.cliAliases ?? [])].filter((path): path is string => Boolean(path));
  return Array.from(new Set(paths));
};

const formatParamName = (name: string) => `--${name.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`;

const normalizeParamName = (name: string) =>
  name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

const describeParamValue = (param: ParamDescriptor) => {
  if (param.type === "boolean") return "";
  if (param.type === "number") return " <number>";
  if (param.type === "list") return " <value...>";
  return " <value>";
};

const coerceParam = (descriptor: ParamDescriptor | undefined, value: string | boolean) => {
  if (descriptor?.type === "number") return typeof value === "number" ? value : Number(value);
  if (descriptor?.type === "boolean") return value === true || value === "true";
  if (descriptor?.type === "json" && typeof value === "string") return JSON.parse(value);
  return value;
};

const firstOptionIndex = (args: string[]) => {
  const index = args.findIndex((arg) => arg.startsWith("-"));
  return index === -1 ? args.length : index;
};

const extractGlobalOptions = (rawArgs: string[]) => {
  const args: string[] = [];
  let projectId: string | undefined;
  let json = false;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--project-id") {
      projectId = rawArgs[index + 1];
      index += 1;
      continue;
    }
    if (arg?.startsWith("--project-id=")) {
      projectId = arg.slice("--project-id=".length);
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg) args.push(arg);
  }

  return { args, json, projectId };
};

const formatCollision = (collision: ExtensionCommandCollision) => {
  const providers = collision.commands
    .map((command) => `${command.extensionId} (${command.id})`)
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
  return `CLI path "${collision.path}" is provided by multiple extension commands: ${providers}`;
};

// The CLI emits a command's result as JSON so callers can pipe/parse it; it owns
// no bespoke per-command formatting.
const outputForResponse = (response: CommandExecuteResponse, json: boolean) => {
  if (json) return JSON.stringify(response);
  if (response.outcome.status === "success") return JSON.stringify(response.outcome.value ?? null);
  return `${response.outcome.status}: ${response.outcome.reason ?? response.outcome.code ?? response.commandId}`;
};

const defaultDeps = (): DispatchDeps => ({
  cwd: () => process.cwd(),
  execute: (commandId, request) => apiClient().extensions.execute(commandId, request),
  listCommands: (projectId) => apiClient().extensions.listCommands(projectId),
  listRepos: (projectId) => apiClient().projects.listRepos(projectId),
  resolveOwningRepoRoot: defaultResolveOwningRepoRoot,
  log: (message) => console.log(message),
  error: (message) => console.error(message),
  resolveProjectId: defaultResolveProjectId,
});

export const buildExtensionCommandTable = (commands: ExtensionCommandRecord[]) => {
  const byNamespace = new Map<string, ExtensionCommandRecord[]>();
  const byPath = new Map<string, ExtensionCommandRecord>();
  const collisionsByPath = new Map<string, ExtensionCommandRecord[]>();

  for (const command of commands) {
    const paths = commandCliPaths(command);
    const scopes = paths.length > 0 ? paths.map((path) => path.split(" ")[0] ?? "") : [command.id.split(".")[0] ?? ""];

    for (const commandScope of new Set(scopes)) {
      const existingNamespace = byNamespace.get(commandScope) ?? [];
      if (!existingNamespace.includes(command)) existingNamespace.push(command);
      byNamespace.set(commandScope, existingNamespace);
    }

    for (const path of paths) {
      const existing = byPath.get(path);
      if (existing) {
        collisionsByPath.set(path, [...(collisionsByPath.get(path) ?? [existing]), command]);
        byPath.delete(path);
        continue;
      }
      if (!collisionsByPath.has(path)) byPath.set(path, command);
    }
  }

  return {
    byPath,
    byNamespace,
    collisions: Array.from(collisionsByPath.entries()).map(([path, pathCommands]) => ({
      path,
      commands: pathCommands,
    })),
  };
};

// Mirrors the yargs command-group layout (scriptName-prefixed paths, aligned
// descriptions, an Options section) so an extension namespace reads the same as a
// core group like `pstdio projects --help`.
export const renderNamespaceHelp = (namespace: string, table: ExtensionCommandTable) => {
  const routes = (table.byNamespace.get(namespace) ?? [])
    .flatMap((command) =>
      commandCliPaths(command)
        .filter((path) => path.split(" ")[0] === namespace)
        .map((path) => ({ command, path })),
    )
    .sort((a, b) => a.path.localeCompare(b.path));

  if (routes.length === 0) return `No extension commands are enabled for namespace "${namespace}".`;

  const rows = routes.map((route) => ({
    command: `pstdio ${route.path}`,
    description: displayString(route.command.description ?? route.command.title),
  }));
  const width = Math.max(...rows.map((row) => row.command.length));

  const lines = [`pstdio ${namespace} [command]`, "", "Commands:"];
  for (const row of rows) lines.push(`  ${row.command.padEnd(width)}  ${row.description}`.trimEnd());
  lines.push("", "Options:", "  --help  Show help  [boolean]");
  return lines.join("\n");
};

export const renderCommandHelp = (command: ExtensionCommandRecord) => {
  const lines = [
    command.cliPath ?? command.id,
    "",
    displayString(command.description ?? command.title),
    "",
    `Command: ${command.id}`,
  ];
  lines.push(`Provider: ${command.extensionId}`);

  if (command.cliAliases?.length) {
    lines.push("", "Aliases:", ...command.cliAliases.map((alias) => `  ${alias}`));
  }

  const params = Object.entries(command.params ?? {});
  if (params.length > 0) {
    lines.push("", "Options:");
    for (const [name, descriptor] of params) {
      lines.push(
        `  ${formatParamName(name)}${describeParamValue(descriptor)}  ${descriptor.description ?? ""}`.trimEnd(),
      );
    }
  }

  if (command.examples?.length) {
    lines.push("", "Examples:", ...command.examples.map((example) => `  ${example}`));
  }

  return lines.join("\n");
};

// The router, unlike the dashboard, has no schema layer in front of it, so it must
// reject invocations missing a required param itself — otherwise a command reads
// `undefined` for a value it declared required and can persist malformed data.
export const missingRequiredParams = (command: ExtensionCommandRecord, params: Record<string, unknown>) =>
  Object.entries(command.params ?? {})
    .filter(([name, descriptor]) => descriptor?.required === true && params[name] === undefined)
    .map(([name]) => name);

const paramsWithSessionContext = (command: ExtensionCommandRecord, params: Record<string, unknown>) => {
  if (!command.params?.sessionId || params.sessionId !== undefined) return params;
  const sessionId = process.env.PSTDIO_SESSION_ID?.trim();
  return sessionId ? { ...params, sessionId } : params;
};

type ExtensionCommandParamDescriptor = NonNullable<ExtensionCommandRecord["params"]>[string];

const readBuiltinCliFlag = (arg: string | undefined) => {
  if (arg === "--help" || arg === "-h") return "help";
  if (arg === "--json") return "json";
  return null;
};

const readParamFlag = (command: ExtensionCommandRecord, args: string[], index: number) => {
  const arg = args[index];
  if (!arg?.startsWith("--")) return null;

  const [rawName, inlineValue] = arg.slice(2).split("=", 2);
  const name = normalizeParamName(rawName ?? "");
  const descriptor = command.params?.[name];
  const value = inlineValue ?? (descriptor?.type === "boolean" ? true : args[index + 1]);
  const nextIndex = inlineValue === undefined && descriptor?.type !== "boolean" ? index + 1 : index;

  return { descriptor, name, nextIndex, value };
};

const assignParamValue = (
  params: Record<string, unknown>,
  name: string,
  descriptor: ExtensionCommandParamDescriptor | undefined,
  value: unknown,
) => {
  if (descriptor?.type !== "list") {
    const scalarValue = typeof value === "string" || typeof value === "boolean" ? value : true;
    params[name] = coerceParam(descriptor, scalarValue);
    return;
  }

  const existing = Array.isArray(params[name]) ? (params[name] as unknown[]) : [];
  existing.push(typeof value === "string" ? value : String(value ?? ""));
  params[name] = existing;
};

export const parseExtensionCommandArgs = (command: ExtensionCommandRecord, args: string[]) => {
  const params: Record<string, unknown> = {};
  let help = false;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const builtinFlag = readBuiltinCliFlag(arg);
    if (builtinFlag === "help") {
      help = true;
      continue;
    }
    if (builtinFlag === "json") {
      json = true;
      continue;
    }

    const paramFlag = readParamFlag(command, args, index);
    if (!paramFlag) continue;
    assignParamValue(params, paramFlag.name, paramFlag.descriptor, paramFlag.value);
    index = paramFlag.nextIndex;
  }

  return { help, json, params };
};

export const formatMissingCommandRecovery = (parts: string[]) => {
  const path = parts.join(" ");
  const extensionId = missingCommandHints.get(path);
  if (!extensionId) return null;
  return `Command "${path}" is provided by ${extensionId}. Install and enable that extension for this project.`;
};

const hasExtensionCommandRoute = (parts: string[], table: ExtensionCommandTable) => {
  const namespace = parts[0];
  return Boolean(namespace && (table.byNamespace.has(namespace) || formatMissingCommandRecovery(parts)));
};

const resolveRepoContext = async (deps: DispatchDeps, projectId: string, root: string | null) => {
  if (!root) return undefined;
  const repos = await deps.listRepos(projectId);
  // A worktree-backed workspace resolves to its owning repo for registration, but keeps
  // its own working-tree path so repoFiles operate on the workspace, not the main checkout.
  const owningRoot = resolvePath(deps.resolveOwningRepoRoot(root));
  const repo = repos.find((candidate) => resolvePath(candidate.path) === owningRoot);
  if (!repo) return undefined;
  return { projectId, repoId: repo.id, path: resolvePath(root) };
};

export const dispatchExtensionCliCommand = async (input: { rawArgs: string[]; deps?: Partial<DispatchDeps> }) => {
  const deps = { ...defaultDeps(), ...input.deps };
  const global = extractGlobalOptions(input.rawArgs);
  const { projectId, root, workspaceId } = deps.resolveProjectId(deps.cwd(), global.projectId);
  const metadata = await deps.listCommands(projectId);
  const commands = localizeCommands(metadata.commands, metadata.translations ?? [], processLocale());
  const table = buildExtensionCommandTable(commands);
  const commandPathParts = global.args.slice(0, firstOptionIndex(global.args));
  const commandPath = commandPathParts.join(" ");

  if (!hasExtensionCommandRoute(commandPathParts, table)) return null;

  const collision = table.collisions.find((candidate) => candidate.path === commandPath);
  if (collision) {
    deps.error?.(formatCollision(collision));
    return 1;
  }

  const command = table.byPath.get(commandPath);
  if (!command) {
    const recovery = formatMissingCommandRecovery(commandPathParts);
    if (recovery) {
      deps.error?.(recovery);
      return 1;
    }

    // A known namespace with no matching leaf command (bare `pstdio <ns>`,
    // `pstdio <ns> --help`, or a mistyped subcommand) lists the namespace's
    // commands, matching how yargs command groups respond.
    deps.log(renderNamespaceHelp(commandPathParts[0]!, table));
    return 0;
  }

  const commandArgs = global.args.slice(pathParts(commandPath).length);
  const parsed = parseExtensionCommandArgs(command, commandArgs);
  const params = paramsWithSessionContext(command, parsed.params);
  if (parsed.help) {
    deps.log(renderCommandHelp(command));
    return 0;
  }

  const missing = missingRequiredParams(command, params);
  if (missing.length > 0) {
    deps.error?.(
      `Missing required ${missing.length === 1 ? "option" : "options"}: ${missing.map(formatParamName).join(", ")}`,
    );
    return 1;
  }

  const response = await deps.execute(command.id, {
    projectId,
    workspaceId,
    params,
    repo: await resolveRepoContext(deps, projectId, root),
    source: "cli",
  });
  const json = global.json || parsed.json;
  const write = response.outcome.ok ? deps.log : (deps.error ?? deps.log);
  write(outputForResponse(response, json));
  return response.outcome.ok ? 0 : 1;
};
