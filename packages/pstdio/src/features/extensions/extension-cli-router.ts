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
  log: (message: string) => void;
  error?: (message: string) => void;
  resolveProjectId: (cwd: string, explicitId?: string) => { projectId: string; root: string | null };
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

export const renderNamespaceHelp = (namespace: string, table: ExtensionCommandTable) => {
  const routes = (table.byNamespace.get(namespace) ?? [])
    .flatMap((command) =>
      commandCliPaths(command)
        .filter((path) => path.split(" ")[0] === namespace)
        .map((path) => ({ command, path })),
    )
    .sort((a, b) => a.path.localeCompare(b.path));

  if (routes.length === 0) return `No extension commands are enabled for namespace "${namespace}".`;

  const lines = [`pstdio ${namespace}`, "", "Commands:"];
  for (const route of routes) {
    lines.push(
      `  ${route.path}  ${displayString(route.command.description ?? route.command.title)}  ${route.command.extensionId}`,
    );
  }
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

export const parseExtensionCommandArgs = (command: ExtensionCommandRecord, args: string[]) => {
  const params: Record<string, unknown> = {};
  let help = false;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (!arg?.startsWith("--")) continue;

    const [rawName, inlineValue] = arg.slice(2).split("=", 2);
    const name = normalizeParamName(rawName ?? "");
    const descriptor = command.params?.[name];
    const value = inlineValue ?? (descriptor?.type === "boolean" ? true : args[index + 1]);
    if (inlineValue === undefined && descriptor?.type !== "boolean") index += 1;
    params[name] = coerceParam(descriptor, value ?? true);
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
  const normalizedRoot = resolvePath(root);
  const repo = repos.find((candidate) => resolvePath(candidate.path) === normalizedRoot);
  if (!repo) return undefined;
  return { projectId, repoId: repo.id, path: repo.path };
};

export const dispatchExtensionCliCommand = async (input: { rawArgs: string[]; deps?: Partial<DispatchDeps> }) => {
  const deps = { ...defaultDeps(), ...input.deps };
  const global = extractGlobalOptions(input.rawArgs);
  const { projectId, root } = deps.resolveProjectId(deps.cwd(), global.projectId);
  const metadata = await deps.listCommands(projectId);
  const commands = localizeCommands(metadata.commands, metadata.translations ?? [], processLocale());
  const table = buildExtensionCommandTable(commands);
  const commandPathParts = global.args.slice(0, firstOptionIndex(global.args));
  const commandPath = commandPathParts.join(" ");
  const wantsHelp = global.args.includes("--help") || global.args.includes("-h");

  if (!hasExtensionCommandRoute(commandPathParts, table)) return null;

  if (commandPathParts.length === 1 && wantsHelp) {
    deps.log(renderNamespaceHelp(commandPathParts[0]!, table));
    return 0;
  }

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

    deps.error?.(`Unknown extension command: ${commandPath}`);
    return 1;
  }

  const commandArgs = global.args.slice(pathParts(commandPath).length);
  const parsed = parseExtensionCommandArgs(command, commandArgs);
  if (parsed.help) {
    deps.log(renderCommandHelp(command));
    return 0;
  }

  const response = await deps.execute(command.id, {
    projectId,
    params: parsed.params,
    repo: await resolveRepoContext(deps, projectId, root),
    source: "cli",
  });
  const json = global.json || parsed.json;
  const write = response.outcome.ok ? deps.log : (deps.error ?? deps.log);
  write(outputForResponse(response, json));
  return response.outcome.ok ? 0 : 1;
};
