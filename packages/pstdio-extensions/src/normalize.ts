import type {
  CliOption,
  ExtensionDiagnostic,
  NormalizedExtension,
  RuntimeArtifactMount,
  RuntimeCliContribution,
  RuntimeCommandRecord,
  RuntimeEventHandler,
  RuntimeHarnessProvider,
  RuntimeSkill,
  RuntimeTemplate,
  RuntimeTemplateType,
} from "@pstdio/sdk/extensions";
import { registerHarnesses, registerSkills, registerTemplates } from "./content-normalization";
import { createErrorDiagnostic } from "./diagnostics";
import type { LoadedExtensionSource } from "./loader";
import { normalizeArtifactPath, normalizeCliPath } from "./path-normalization";

type RuntimeAccumulator = {
  extensions: NormalizedExtension[];
  commands: RuntimeCommandRecord[];
  cli: RuntimeCliContribution[];
  events: RuntimeEventHandler[];
  artifactMounts: RuntimeArtifactMount[];
  templateTypes: RuntimeTemplateType[];
  templates: RuntimeTemplate[];
  skills: RuntimeSkill[];
  harnesses: RuntimeHarnessProvider[];
  diagnostics: ExtensionDiagnostic[];
};

const EXTENSION_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeCliOptions = (options: unknown) => {
  if (!isRecord(options)) return undefined;
  return options as Record<string, CliOption>;
};

const hasValidIdentity = (source: LoadedExtensionSource, diagnostics: ExtensionDiagnostic[]) => {
  const { id, name } = source.definition;

  if (typeof id !== "string" || !EXTENSION_ID_PATTERN.test(id)) {
    diagnostics.push(
      createErrorDiagnostic({
        code: "invalid_extension_id",
        message: `Extension id must match ${EXTENSION_ID_PATTERN}`,
        sourcePath: source.sourcePath,
        extensionId: typeof id === "string" ? id : undefined,
      }),
    );
    return false;
  }

  if (typeof name === "string" && name.length > 0) return true;

  diagnostics.push(
    createErrorDiagnostic({
      code: "invalid_export",
      message: "Extension definition must include a display name",
      sourcePath: source.sourcePath,
      extensionId: id,
    }),
  );
  return false;
};

const registerExtension = (
  source: LoadedExtensionSource,
  runtime: RuntimeAccumulator,
  extensionSources: Map<string, LoadedExtensionSource>,
) => {
  const { id, name, version } = source.definition;
  const existing = extensionSources.get(id);
  if (existing) {
    runtime.diagnostics.push(
      createErrorDiagnostic({
        code: "duplicate_extension_id",
        message: `Extension id "${id}" is already provided`,
        extensionId: id,
        sourcePath: source.sourcePath,
        related: [
          { extensionId: id, sourcePath: existing.sourcePath },
          { extensionId: id, sourcePath: source.sourcePath },
        ],
      }),
    );
  } else {
    extensionSources.set(id, source);
  }

  runtime.extensions.push({
    id,
    displayName: name,
    version,
    sourcePath: source.sourcePath,
    sourceKind: source.sourceKind,
    definition: source.definition,
  });
};

const normalizeCommandCli = (
  extensionId: string,
  commandId: string,
  sourcePath: string,
  cli: unknown,
  runtime: RuntimeAccumulator,
  cliOwners: Map<string, RuntimeCliContribution>,
) => {
  if (!isRecord(cli) || typeof cli.path !== "string") return undefined;

  const normalized = normalizeCliPath(cli.path);
  if (normalized.path.length === 0) return undefined;

  const contribution: RuntimeCliContribution = {
    path: normalized.path,
    pathSegments: normalized.pathSegments,
    examples: Array.isArray(cli.examples) ? cli.examples.filter((example) => typeof example === "string") : [],
    commandId,
    extensionId,
    description: typeof cli.description === "string" ? cli.description : undefined,
    options: normalizeCliOptions(cli.options),
    positionals: normalizeCliOptions(cli.positionals),
    hidden: typeof cli.hidden === "boolean" ? cli.hidden : undefined,
  };

  const existing = cliOwners.get(contribution.path);
  if (existing) {
    runtime.diagnostics.push(
      createErrorDiagnostic({
        code: "duplicate_cli_path",
        message: `CLI path "${contribution.path}" is already provided`,
        extensionId,
        sourcePath,
        related: [
          { extensionId: existing.extensionId, commandId: existing.commandId, path: existing.path },
          { extensionId, commandId, path: contribution.path, sourcePath },
        ],
      }),
    );
  } else {
    cliOwners.set(contribution.path, contribution);
  }

  runtime.cli.push(contribution);
  return contribution;
};

const registerCommands = (
  source: LoadedExtensionSource,
  runtime: RuntimeAccumulator,
  commandOwners: Map<string, RuntimeCommandRecord>,
  cliOwners: Map<string, RuntimeCliContribution>,
) => {
  for (const [key, command] of Object.entries(source.definition.commands ?? {})) {
    const extensionId = source.definition.id;
    const commandId = `${extensionId}.${key}`;
    if (!isRecord(command) || typeof command.title !== "string" || typeof command.run !== "function") {
      runtime.diagnostics.push(
        createErrorDiagnostic({
          code: "invalid_command",
          message: `Extension command "${commandId}" must define title and run(ctx)`,
          extensionId,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    const cli = normalizeCommandCli(extensionId, commandId, source.sourcePath, command.cli, runtime, cliOwners);
    const record: RuntimeCommandRecord = {
      ...command,
      id: commandId,
      key,
      extensionId,
      menus: Array.isArray(command.menus) ? command.menus : [],
      cli,
      sourcePath: source.sourcePath,
    };
    const existing = commandOwners.get(commandId);
    if (existing) {
      runtime.diagnostics.push(
        createErrorDiagnostic({
          code: "duplicate_command_id",
          message: `Command id "${commandId}" is already provided`,
          extensionId,
          sourcePath: source.sourcePath,
          related: [
            { extensionId: existing.extensionId, commandId: existing.id, sourcePath: existing.sourcePath },
            { extensionId, commandId, sourcePath: source.sourcePath },
          ],
        }),
      );
    } else {
      commandOwners.set(commandId, record);
    }

    runtime.commands.push(record);
  }
};

const resolveEventId = (event: unknown) => {
  if (typeof event === "string" && event.length > 0) return event;
  if (isRecord(event) && typeof event.id === "string" && event.id.length > 0) return event.id;
  return null;
};

const registerEvents = (source: LoadedExtensionSource, runtime: RuntimeAccumulator) => {
  for (const [key, eventHandler] of Object.entries(source.definition.events ?? {})) {
    if (!isRecord(eventHandler) || typeof eventHandler.handler !== "function") continue;

    const eventId = resolveEventId(eventHandler.event);
    if (!eventId) continue;

    const extensionId = source.definition.id;
    runtime.events.push({
      ...eventHandler,
      id: `${extensionId}.${key}`,
      key,
      extensionId,
      event: eventHandler.event as RuntimeEventHandler["event"],
      eventId,
      sourcePath: source.sourcePath,
    });
  }
};

const registerArtifactMounts = (
  source: LoadedExtensionSource,
  runtime: RuntimeAccumulator,
  mountOwners: Map<string, RuntimeArtifactMount>,
) => {
  for (const [key, mount] of Object.entries(source.definition.artifactMounts ?? {})) {
    const extensionId = source.definition.id;
    if (!isRecord(mount) || typeof mount.path !== "string" || typeof mount.label !== "string") continue;

    const path = normalizeArtifactPath(mount.path);
    if (!path) {
      runtime.diagnostics.push(
        createErrorDiagnostic({
          code: "unsafe_artifact_mount_path",
          message: `Artifact mount "${key}" must stay under .pstdio`,
          extensionId,
          sourcePath: source.sourcePath,
          related: [{ extensionId, path: mount.path }],
        }),
      );
      continue;
    }

    const record: RuntimeArtifactMount = {
      ...mount,
      id: `${extensionId}.${key}`,
      key,
      extensionId,
      path,
      sourcePath: source.sourcePath,
    };
    const existing = mountOwners.get(path);
    if (existing) {
      runtime.diagnostics.push(
        createErrorDiagnostic({
          code: "duplicate_artifact_mount",
          message: `Artifact mount path "${path}" is already provided`,
          extensionId,
          sourcePath: source.sourcePath,
          related: [
            { extensionId: existing.extensionId, path: existing.path, sourcePath: existing.sourcePath },
            { extensionId, path, sourcePath: source.sourcePath },
          ],
        }),
      );
      continue;
    }

    mountOwners.set(path, record);
    runtime.artifactMounts.push(record);
  }
};

export const normalizeExtensionSources = (
  sources: LoadedExtensionSource[],
  initialDiagnostics: ExtensionDiagnostic[] = [],
) => {
  const runtime: RuntimeAccumulator = {
    extensions: [],
    commands: [],
    cli: [],
    events: [],
    artifactMounts: [],
    templateTypes: [],
    templates: [],
    skills: [],
    harnesses: [],
    diagnostics: [...initialDiagnostics],
  };
  const extensionSources = new Map<string, LoadedExtensionSource>();
  const commandOwners = new Map<string, RuntimeCommandRecord>();
  const cliOwners = new Map<string, RuntimeCliContribution>();
  const mountOwners = new Map<string, RuntimeArtifactMount>();

  for (const source of sources) {
    if (!hasValidIdentity(source, runtime.diagnostics)) continue;

    registerExtension(source, runtime, extensionSources);
    registerCommands(source, runtime, commandOwners, cliOwners);
    registerEvents(source, runtime);
    registerArtifactMounts(source, runtime, mountOwners);
    registerTemplates(source, runtime);
    registerSkills(source, runtime);
    registerHarnesses(source, runtime);
  }

  return runtime;
};
