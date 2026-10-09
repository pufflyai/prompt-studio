import type {
  CommandExecuteRequest,
  CommandExecuteResponse,
  ExtensionCommandRecord,
  ListExtensionCommandsResponse,
  LocalizableString,
} from "@pstdio/sdk/api";
import type { ExtensionClient } from "@pstdio/sdk/client";
import { apiClient } from "../api-client";
import { resolveProjectId as defaultResolveProjectId } from "../projects/resolve-project-id";
import { describeParamValue, formatParamName, parseExtensionCommandArgs } from "./extension-cli-args";
import { printExtensionCommandStream } from "./extension-cli-stream";

export { parseExtensionCommandArgs } from "./extension-cli-args";

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
  stream: ExtensionClient["stream"];
  cwd: () => string;
  execute: (commandId: string, request: CommandExecuteRequest) => Promise<CommandExecuteResponse>;
  listCommands: (projectId: string) => Promise<ListExtensionCommandsResponse>;
  log: (message: string) => void;
  error?: (message: string) => void;
  resolveProjectId: (
    cwd: string,
    explicitId?: string,
  ) => { projectId: string; root: string | null; workspaceId?: string };
};

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
  stream: (...args) => apiClient().extensions.stream(...args),
  listCommands: (projectId) => apiClient().extensions.listCommands(projectId),
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

  lines.push("", "  --stream  Stream command chunks as NDJSON");
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

const hasExtensionCommandRoute = (parts: string[], table: ExtensionCommandTable) => {
  const namespace = parts[0];
  return Boolean(namespace && table.byNamespace.has(namespace));
};

export const dispatchExtensionCliCommand = async (input: {
  rawArgs: string[];
  deps?: Partial<DispatchDeps>;
  onCommandResolved?: (command: ExtensionCommandRecord) => void;
}) => {
  const deps = { ...defaultDeps(), ...input.deps };
  const global = extractGlobalOptions(input.rawArgs);
  const { projectId, workspaceId } = deps.resolveProjectId(deps.cwd(), global.projectId);
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
    // A namespace or command group lists the namespace's commands, matching how yargs
    // command groups respond. A mistyped command must fail so scripts and agents notice.
    const help = renderNamespaceHelp(commandPathParts[0]!, table);
    const group = !commandPathParts[1] || [...table.byPath.keys()].some((p) => p.startsWith(`${commandPath} `));
    if (!group) (deps.error ?? deps.log)(`Unknown command "pstdio ${commandPath}".\n\n${help}`);
    else deps.log(help);
    return group ? 0 : 1;
  }

  input.onCommandResolved?.(command);

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

  if (parsed.stream)
    return printExtensionCommandStream({
      commandId: command.id,
      request: { projectId, workspaceId, params, source: "cli" },
      stream: deps.stream,
      log: deps.log,
    });

  const response = await deps.execute(command.id, {
    projectId,
    workspaceId,
    params,
    source: "cli",
  });
  const json = global.json || parsed.json;
  const write = response.outcome.ok ? deps.log : (deps.error ?? deps.log);
  write(outputForResponse(response, json));
  return response.outcome.ok ? 0 : 1;
};
