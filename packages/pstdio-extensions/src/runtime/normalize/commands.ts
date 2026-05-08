import { normalizeCliPath } from "../../artifacts/path-normalization";
import type { NormalizedExtension, RuntimeCliContribution, RuntimeCommandRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { hasCompatibleSlotKind } from "./slot-kind";

const splitCommandKey = (key: string) => key.split(".");

const normalizeCommandCli = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  commandId: string,
  localId: string,
  cli: unknown,
  runtime: Accumulator,
  cliKeys: Map<string, RuntimeCliContribution>,
): RuntimeCliContribution | undefined => {
  if (cli === undefined || cli === false) return undefined;

  const customPath = isRecord(cli) && Array.isArray(cli.path) ? (cli.path as string[]) : splitCommandKey(localId);
  const normalized = normalizeCliPath(customPath);
  if (!normalized) return undefined;

  const pathKey = [ext.namespace, ...normalized.segments].join(" ");

  const contribution: RuntimeCliContribution = {
    extensionId: ext.id,
    commandId,
    namespace: ext.namespace,
    path: normalized.segments,
    pathKey,
    description: isRecord(cli) && typeof cli.description === "string" ? cli.description : undefined,
    examples:
      isRecord(cli) && Array.isArray(cli.examples)
        ? cli.examples.filter((example): example is string => typeof example === "string")
        : undefined,
    hidden: isRecord(cli) && typeof cli.hidden === "boolean" ? cli.hidden : undefined,
    globalAliases:
      isRecord(cli) && Array.isArray(cli.globalAliases)
        ? (cli.globalAliases as string[][]).filter((alias) => Array.isArray(alias))
        : undefined,
  };

  const existing = cliKeys.get(pathKey);
  if (existing) {
    runtime.diagnostics.push(
      createDiagnostic({
        code: "duplicate_cli_path",
        message: `CLI path "${pathKey}" is already provided by ${existing.commandId}`,
        extensionId: ext.id,
        commandId,
        metadata: {
          existingCommandId: existing.commandId,
          existingExtensionId: existing.extensionId,
          pathKey,
        },
        sourcePath: source.sourcePath,
      }),
    );
    return contribution;
  }

  cliKeys.set(pathKey, contribution);
  runtime.cli.push(contribution);
  return contribution;
};

export const registerCommands = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, command] of Object.entries(source.definition.commands ?? {})) {
    const commandId = `${ext.namespace}.${localId}`;

    if (!isRecord(command) || typeof command.title !== "string" || typeof command.run !== "function") {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_command",
          message: `Command "${commandId}" must define title and run(ctx)`,
          extensionId: ext.id,
          commandId,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    const cli = normalizeCommandCli(ext, source, commandId, localId, command.cli, runtime, index.cliKeys);

    const menus = (Array.isArray(command.menus) ? command.menus : []).filter((menu, index) =>
      hasCompatibleSlotKind({
        runtime,
        source: { extensionId: ext.id, sourcePath: source.sourcePath },
        expected: "menu",
        slot: isRecord(menu) ? menu.slot : undefined,
        contributionId: `${commandId}.menus[${index}]`,
      }),
    );

    const record: RuntimeCommandRecord = {
      id: commandId,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      title: command.title,
      description: typeof command.description === "string" ? command.description : undefined,
      params: isRecord(command.params) ? (command.params as RuntimeCommandRecord["params"]) : {},
      menus: menus as RuntimeCommandRecord["menus"],
      cli,
      run: command.run as RuntimeCommandRecord["run"],
    };

    const existing = index.commandIds.get(commandId);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_command_id",
          message: `Command id "${commandId}" is already provided by ${existing.sourcePath}`,
          extensionId: ext.id,
          commandId,
          sourcePath: source.sourcePath,
        }),
      );
      continue;
    }

    index.commandIds.set(commandId, record);
    runtime.commands.push(record);
  }
};
